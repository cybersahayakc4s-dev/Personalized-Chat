import { getServerBaseUrl } from '../services/api';

export const resolveMediaUrl = (url?: string): string => {
  if (!url || url === '#') return '#';
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = getServerBaseUrl() || (typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:8000');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
};

/**
 * Downloads any attachment file as a local Blob with the exact original filename and extension.
 * Completely eliminates browser cross-origin generic naming (e.g. "view" without extension).
 */
export const downloadAttachmentFile = async (rawUrl: string, originalFilename?: string): Promise<void> => {
  if (!rawUrl || rawUrl === '#') return;

  const fallbackName = originalFilename || 'download';
  const fullUrl = resolveMediaUrl(rawUrl);

  try {
    const token = localStorage.getItem('chat_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(fullUrl, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fallbackName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    // Clean up
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }, 200);
  } catch (err) {
    console.warn('Direct blob download failed, falling back to direct link:', err);
    // Fallback: append query token if needed and trigger browser open
    const token = localStorage.getItem('chat_token');
    const targetUrl = token && !fullUrl.includes('token=')
      ? `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : fullUrl;
    const fallbackAnchor = document.createElement('a');
    fallbackAnchor.href = targetUrl;
    fallbackAnchor.download = fallbackName;
    fallbackAnchor.target = '_blank';
    fallbackAnchor.rel = 'noopener noreferrer';
    document.body.appendChild(fallbackAnchor);
    fallbackAnchor.click();
    setTimeout(() => {
      if (fallbackAnchor.parentNode) fallbackAnchor.parentNode.removeChild(fallbackAnchor);
    }, 200);
  }
};
