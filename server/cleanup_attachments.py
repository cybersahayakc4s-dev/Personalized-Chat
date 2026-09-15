#!/usr/bin/env python3
"""
Personalize Chat — Production Attachment Retention & Orphan Cleanup Utility

Features:
- Dry-run mode by default (zero destructive actions without explicit --execute flag)
- Identification of orphaned files on disk with no DB Attachment record
- Identification of expired attachments associated with soft-deleted messages
- Path traversal & symlink escape validation
- Non-destructive execution (never deletes message records or active conversation files)
- Audit logging & summary reporting
"""

import os
import sys
import logging
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any, List, Set
from pathlib import Path

# Add server directory to path for standalone execution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.message import Message
from app.models.attachment import Attachment
from app.models.workspace_settings import WorkspaceSettings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cleanup_attachments")


def is_safe_subpath(target_path: str, base_dir: str) -> bool:
    """
    Validates that target_path strictly resides within base_dir.
    Guards against directory traversal, relative path escapes, and symlink escapes.
    """
    try:
        real_base = os.path.realpath(base_dir)
        real_target = os.path.realpath(target_path)
        
        # Target must be a descendant of base_dir
        common = os.path.commonpath([real_base, real_target])
        if common != real_base or real_target == real_base:
            return False

        # If target exists and is a symlink, verify link target also stays within base
        if os.path.islink(target_path):
            link_target = os.path.realpath(os.readlink(target_path))
            if os.path.commonpath([real_base, link_target]) != real_base:
                return False

        return True
    except Exception as e:
        logger.warning(f"Path safety check exception for '{target_path}': {e}")
        return False


def scan_orphan_files(upload_dir: str, db) -> List[Dict[str, Any]]:
    """
    Scans upload directory for files on disk that have NO corresponding record
    in the attachments database table.
    """
    orphans = []
    if not os.path.exists(upload_dir):
        return orphans

    # Fetch all active file paths recorded in database
    db_paths: Set[str] = set()
    for (path_val,) in db.query(Attachment.file_path).all():
        if path_val:
            try:
                db_paths.add(os.path.realpath(path_val))
            except Exception:
                pass

    real_upload_dir = os.path.realpath(upload_dir)

    # Inspect files in upload directory
    with os.scandir(real_upload_dir) as entries:
        for entry in entries:
            # Skip subdirectories and internal dotfiles (e.g. healthcheck probe)
            if entry.name.startswith("."):
                continue
            if not entry.is_file(follow_symlinks=False):
                continue

            file_path = entry.path
            if not is_safe_subpath(file_path, upload_dir):
                logger.warning(f"Skipping unsafe file outside upload directory: {file_path}")
                continue

            real_file_path = os.path.realpath(file_path)
            if real_file_path not in db_paths:
                try:
                    stat_info = entry.stat(follow_symlinks=False)
                    orphans.append({
                        "file_name": entry.name,
                        "file_path": file_path,
                        "size_bytes": stat_info.st_size,
                        "modified_at": datetime.fromtimestamp(stat_info.st_mtime).isoformat() + "Z",
                        "reason": "orphan_no_db_record"
                    })
                except OSError as e:
                    logger.warning(f"Could not read stats for orphan candidate '{file_path}': {e}")

    return orphans


def scan_expired_deleted_attachments(retention_days: int, upload_dir: str, db) -> List[Dict[str, Any]]:
    """
    Scans for attachments associated with soft-deleted messages where deleted_at
    is older than retention_days.
    """
    expired = []
    cutoff_time = datetime.utcnow() - timedelta(days=retention_days)

    # Query attachments whose parent message is soft-deleted beyond the retention window
    query = (
        db.query(Attachment, Message)
        .join(Message, Attachment.message_id == Message.id)
        .filter(
            Message.deleted_at.isnot(None),
            Message.deleted_at < cutoff_time
        )
    )

    for att, msg in query.all():
        if not att.file_path:
            continue

        if not is_safe_subpath(att.file_path, upload_dir):
            logger.warning(f"Attachment {att.id} path '{att.file_path}' fails path safety validation. Skipping.")
            continue

        file_exists = os.path.exists(att.file_path)
        size = att.file_size_bytes or 0
        if file_exists:
            try:
                size = os.path.getsize(att.file_path)
            except OSError:
                pass

        expired.append({
            "attachment_id": att.id,
            "message_id": msg.id,
            "file_name": att.file_name,
            "file_path": att.file_path,
            "size_bytes": size,
            "message_deleted_at": msg.deleted_at.isoformat() + "Z" if msg.deleted_at else None,
            "file_exists": file_exists,
            "reason": f"soft_deleted_message_older_than_{retention_days}_days"
        })

    return expired


def run_cleanup(
    dry_run: bool = True,
    retention_days: int = None,
    upload_dir: str = None,
    db_session = None
) -> Dict[str, Any]:
    """
    Executes attachment scan and optional physical deletion.
    Returns structured results dictionary.
    """
    target_upload_dir = upload_dir or settings.UPLOAD_DIR
    db = db_session if db_session is not None else SessionLocal()
    should_close = (db_session is None)

    try:
        # Resolve retention days
        if retention_days is None:
            ws = db.query(WorkspaceSettings).first()
            retention_days = ws.retention_days if ws else 90

        logger.info(
            f"Starting attachment cleanup scan (mode={'DRY-RUN' if dry_run else 'EXECUTE'}, "
            f"retention_days={retention_days}, upload_dir='{target_upload_dir}')"
        )

        orphans = scan_orphan_files(target_upload_dir, db)
        expired = scan_expired_deleted_attachments(retention_days, target_upload_dir, db)

        total_orphan_bytes = sum(o["size_bytes"] for o in orphans)
        total_expired_bytes = sum(e["size_bytes"] for e in expired if e["file_exists"])
        total_reclaimable_bytes = total_orphan_bytes + total_expired_bytes

        deleted_orphans_count = 0
        deleted_expired_count = 0
        errors: List[str] = []

        if not dry_run:
            logger.info("EXECUTE mode active: proceeding with physical file removal...")

            # 1. Remove orphan files
            for o in orphans:
                path_to_remove = o["file_path"]
                if is_safe_subpath(path_to_remove, target_upload_dir) and os.path.exists(path_to_remove):
                    try:
                        os.remove(path_to_remove)
                        deleted_orphans_count += 1
                        logger.info(f"Removed orphan file: {path_to_remove}")
                    except Exception as err:
                        err_msg = f"Failed to remove orphan '{path_to_remove}': {err}"
                        logger.error(err_msg)
                        errors.append(err_msg)

            # 2. Remove expired deleted-message files
            for e in expired:
                path_to_remove = e["file_path"]
                if e["file_exists"] and is_safe_subpath(path_to_remove, target_upload_dir) and os.path.exists(path_to_remove):
                    try:
                        os.remove(path_to_remove)
                        deleted_expired_count += 1
                        logger.info(f"Removed expired soft-deleted attachment file: {path_to_remove}")
                    except Exception as err:
                        err_msg = f"Failed to remove expired file '{path_to_remove}': {err}"
                        logger.error(err_msg)
                        errors.append(err_msg)

        summary = {
            "mode": "dry-run" if dry_run else "execute",
            "retention_days": retention_days,
            "upload_dir": target_upload_dir,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "orphans_found": len(orphans),
            "orphan_bytes": total_orphan_bytes,
            "expired_found": len(expired),
            "expired_bytes": total_expired_bytes,
            "total_reclaimable_bytes": total_reclaimable_bytes,
            "orphans_deleted": deleted_orphans_count,
            "expired_deleted": deleted_expired_count,
            "errors": errors,
            "orphan_files": orphans,
            "expired_files": expired
        }

        logger.info(
            f"Cleanup scan complete: {len(orphans)} orphans ({total_orphan_bytes / 1024 / 1024:.2f} MB), "
            f"{len(expired)} expired files ({total_expired_bytes / 1024 / 1024:.2f} MB). "
            f"Total reclaimable: {total_reclaimable_bytes / 1024 / 1024:.2f} MB. "
            f"Deleted: {deleted_orphans_count + deleted_expired_count} files."
        )

        return summary

    finally:
        if should_close:
            db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Personalize Chat — Attachment Retention & Orphan File Cleanup Utility"
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Perform inspection and report reclaimable storage without deleting files (default)."
    )
    group.add_argument(
        "--execute",
        action="store_true",
        help="Execute physical deletion of verified orphan and expired attachment files."
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=None,
        help="Custom retention threshold in days for soft-deleted message attachments (default: workspace retention setting or 90)."
    )
    parser.add_argument(
        "--upload-dir",
        type=str,
        default=None,
        help="Target upload directory path (default: configured UPLOAD_DIR)."
    )

    args = parser.parse_args()
    dry_run = not args.execute

    res = run_cleanup(
        dry_run=dry_run,
        retention_days=args.retention_days,
        upload_dir=args.upload_dir
    )

    if dry_run:
        print("\n[DRY-RUN SUMMARY] No files were deleted. Re-run with --execute to perform deletion.")
    else:
        print("\n[EXECUTION SUMMARY] Physical file cleanup complete.")

    print(f"  • Orphans Found: {res['orphans_found']} ({res['orphan_bytes']} bytes)")
    print(f"  • Expired Attachments Found: {res['expired_found']} ({res['expired_bytes']} bytes)")
    print(f"  • Total Reclaimable: {res['total_reclaimable_bytes'] / (1024 * 1024):.2f} MB")
    if not dry_run:
        print(f"  • Orphan Files Deleted: {res['orphans_deleted']}")
        print(f"  • Expired Files Deleted: {res['expired_deleted']}")
        if res['errors']:
            print(f"  • Errors Encountered: {len(res['errors'])}")


if __name__ == "__main__":
    main()
