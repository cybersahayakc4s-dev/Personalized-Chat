import React from 'react';

export type FormatType = 'bold' | 'italic' | 'strikethrough' | 'code' | 'bullet' | 'ordered' | 'quote' | 'link';

/**
 * Intelligent formatting with automatic word boundary detection and toggle-off support.
 */
export function applySmartFormatting(
  textarea: HTMLTextAreaElement,
  text: string,
  setText: (newText: string) => void,
  formatType: FormatType
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // 1. Hyperlink
  if (formatType === 'link') {
    const selected = text.substring(start, end);
    const replacement = selected ? `[${selected}](https://)` : `[link](https://)`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      if (selected) {
        // Highlight url part
        textarea.setSelectionRange(start + selected.length + 3, start + replacement.length - 1);
      } else {
        // Highlight 'link' part
        textarea.setSelectionRange(start + 1, start + 5);
      }
    }, 10);
    return;
  }

  // 2. Blockquote
  if (formatType === 'quote') {
    if (start !== end) {
      const selected = text.substring(start, end);
      const isAllQuoted = selected.split('\n').every(l => l.startsWith('>') || !l.trim());
      let replacement: string;
      if (isAllQuoted) {
        // Toggle off
        replacement = selected.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n');
      } else {
        replacement = selected.split('\n').map(l => (l.startsWith('>') ? l : `> ${l}`)).join('\n');
      }
      const newText = text.substring(0, start) + replacement + text.substring(end);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replacement.length);
      }, 10);
    } else {
      // Find beginning of current line
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = text.indexOf('\n', start);
      const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
      const currentLine = text.substring(lineStart, actualLineEnd);

      if (currentLine.startsWith('> ')) {
        // Toggle off
        const newText = text.substring(0, lineStart) + currentLine.slice(2) + text.substring(actualLineEnd);
        setText(newText);
        setTimeout(() => {
          textarea.focus();
          const newPos = Math.max(lineStart, start - 2);
          textarea.setSelectionRange(newPos, newPos);
        }, 10);
      } else {
        // Insert quote
        const prefix = text.substring(0, lineStart);
        const suffix = text.substring(lineStart);
        const newText = prefix + '> ' + suffix;
        setText(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 2, start + 2);
        }, 10);
      }
    }
    return;
  }

  // 3. Bullet List
  if (formatType === 'bullet') {
    if (start !== end) {
      const selected = text.substring(start, end);
      const isAllBulleted = selected.split('\n').every(l => l.startsWith('- ') || !l.trim());
      let replacement: string;
      if (isAllBulleted) {
        replacement = selected.split('\n').map(l => l.replace(/^-\s/, '')).join('\n');
      } else {
        replacement = selected.split('\n').map(l => (l.startsWith('- ') ? l : `- ${l}`)).join('\n');
      }
      const newText = text.substring(0, start) + replacement + text.substring(end);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replacement.length);
      }, 10);
    } else {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = text.indexOf('\n', start);
      const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
      const currentLine = text.substring(lineStart, actualLineEnd);

      if (currentLine.startsWith('- ')) {
        const newText = text.substring(0, lineStart) + currentLine.slice(2) + text.substring(actualLineEnd);
        setText(newText);
        setTimeout(() => {
          textarea.focus();
          const newPos = Math.max(lineStart, start - 2);
          textarea.setSelectionRange(newPos, newPos);
        }, 10);
      } else {
        const prefix = text.substring(0, lineStart);
        const suffix = text.substring(lineStart);
        const newText = prefix + '- ' + suffix;
        setText(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 2, start + 2);
        }, 10);
      }
    }
    return;
  }

  // 4. Numbered List
  if (formatType === 'ordered') {
    if (start !== end) {
      const selected = text.substring(start, end);
      const lines = selected.split('\n');
      const isAllNumbered = lines.every(l => /^\d+\.\s/.test(l) || !l.trim());
      let replacement: string;
      if (isAllNumbered) {
        replacement = lines.map(l => l.replace(/^\d+\.\s/, '')).join('\n');
      } else {
        replacement = lines.map((l, i) => (/^\d+\.\s/.test(l) ? l : `${i + 1}. ${l}`)).join('\n');
      }
      const newText = text.substring(0, start) + replacement + text.substring(end);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replacement.length);
      }, 10);
    } else {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = text.indexOf('\n', start);
      const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
      const currentLine = text.substring(lineStart, actualLineEnd);

      if (/^\d+\.\s/.test(currentLine)) {
        const stripped = currentLine.replace(/^\d+\.\s/, '');
        const newText = text.substring(0, lineStart) + stripped + text.substring(actualLineEnd);
        setText(newText);
        setTimeout(() => {
          textarea.focus();
          const removedLen = currentLine.length - stripped.length;
          const newPos = Math.max(lineStart, start - removedLen);
          textarea.setSelectionRange(newPos, newPos);
        }, 10);
      } else {
        const prefix = text.substring(0, lineStart);
        const suffix = text.substring(lineStart);
        const newText = prefix + '1. ' + suffix;
        setText(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 3, start + 3);
        }, 10);
      }
    }
    return;
  }

  // 5. Inline Markers: Bold (**), Italic (*), Strikethrough (~~), Code (`)
  let marker = '**';
  if (formatType === 'italic') marker = '*';
  if (formatType === 'strikethrough') marker = '~~';
  if (formatType === 'code') marker = '`';
  const mLen = marker.length;

  // CASE 1: User highlighted / selected text
  if (start !== end) {
    const selected = text.substring(start, end);

    // If selected text is already wrapped in marker -> toggle off
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= mLen * 2) {
      const unwrapped = selected.slice(mLen, -mLen);
      const newText = text.substring(0, start) + unwrapped + text.substring(end);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + unwrapped.length);
      }, 10);
      return;
    }

    // If outer text surrounds selection -> toggle off
    if (start >= mLen && text.substring(start - mLen, start) === marker && text.substring(end, end + mLen) === marker) {
      const newText = text.substring(0, start - mLen) + selected + text.substring(end + mLen);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start - mLen, start - mLen + selected.length);
      }, 10);
      return;
    }

    // Wrap selected text
    const wrapped = `${marker}${selected}${marker}`;
    const newText = text.substring(0, start) + wrapped + text.substring(end);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + mLen, end + mLen);
    }, 10);
    return;
  }

  // CASE 2: No selection -> automatically detect the current word under cursor
  let wordStart = start;
  let wordEnd = start;

  // Delimiters for words: whitespace and standard punctuation
  const isDelimiter = (ch: string) => /\s|[.,!?;:()\[\]{}"'\n]/.test(ch);

  while (wordStart > 0 && !isDelimiter(text[wordStart - 1])) {
    wordStart--;
  }
  while (wordEnd < text.length && !isDelimiter(text[wordEnd])) {
    wordEnd++;
  }

  if (wordStart < wordEnd) {
    const word = text.substring(wordStart, wordEnd);

    // If word is already wrapped -> toggle off
    if (word.startsWith(marker) && word.endsWith(marker) && word.length >= mLen * 2) {
      const unwrapped = word.slice(mLen, -mLen);
      const newText = text.substring(0, wordStart) + unwrapped + text.substring(wordEnd);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(wordStart + unwrapped.length, wordStart + unwrapped.length);
      }, 10);
      return;
    }

    // If outer text surrounds word -> toggle off
    if (wordStart >= mLen && text.substring(wordStart - mLen, wordStart) === marker && text.substring(wordEnd, wordEnd + mLen) === marker) {
      const newText = text.substring(0, wordStart - mLen) + word + text.substring(wordEnd + mLen);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(wordStart - mLen + word.length, wordStart - mLen + word.length);
      }, 10);
      return;
    }

    // Wrap word automatically
    const wrapped = `${marker}${word}${marker}`;
    const newText = text.substring(0, wordStart) + wrapped + text.substring(wordEnd);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(wordStart + wrapped.length, wordStart + wrapped.length);
    }, 10);
    return;
  }

  // CASE 3: Cursor is on empty space -> insert marker pair and place cursor in the middle
  const insert = `${marker}${marker}`;
  const newText = text.substring(0, start) + insert + text.substring(end);
  setText(newText);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + mLen, start + mLen);
  }, 10);
}

/**
 * Handles Smart Enter behavior for bullet lists (- ), numbered lists (1. ), and quotes (> ).
 * - Pressing Enter on a populated list line continues the list on the next line.
 * - Pressing Enter on an empty list line exits list mode cleanly.
 * Returns true if handled (default prevented), false otherwise.
 */
export function handleSmartEnter(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  textarea: HTMLTextAreaElement,
  text: string,
  setText: (newText: string) => void
): boolean {
  if (e.key !== 'Enter' || e.shiftKey) return false;

  const start = textarea.selectionStart;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = text.indexOf('\n', start);
  const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
  const currentLine = text.substring(lineStart, actualLineEnd);

  // 1. Bullet list continuation (- , • , * )
  const bulletMatch = currentLine.match(/^(\s*)([-•*]\s)(.*)$/);
  if (bulletMatch) {
    e.preventDefault();
    const [_, indent, bulletSymbol, lineContent] = bulletMatch;
    if (!lineContent.trim()) {
      // Empty list item -> exit list mode by deleting the bullet
      const newText = text.substring(0, lineStart) + indent + text.substring(actualLineEnd);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart + indent.length, lineStart + indent.length);
      }, 10);
      return true;
    }
    // Populate next bullet
    const insertion = `\n${indent}${bulletSymbol}`;
    const newText = text.substring(0, start) + insertion + text.substring(start);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
    return true;
  }

  // 2. Numbered list continuation (1. , 2. )
  const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
  if (orderedMatch) {
    e.preventDefault();
    const [_, indent, numStr, lineContent] = orderedMatch;
    if (!lineContent.trim()) {
      // Empty numbered item -> exit list mode
      const newText = text.substring(0, lineStart) + indent + text.substring(actualLineEnd);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart + indent.length, lineStart + indent.length);
      }, 10);
      return true;
    }
    const nextNum = parseInt(numStr, 10) + 1;
    const insertion = `\n${indent}${nextNum}. `;
    const newText = text.substring(0, start) + insertion + text.substring(start);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
    return true;
  }

  // 3. Blockquote continuation (> )
  const quoteMatch = currentLine.match(/^(\s*)(>\s?)(.*)$/);
  if (quoteMatch) {
    e.preventDefault();
    const [_, indent, quoteSymbol, lineContent] = quoteMatch;
    if (!lineContent.trim()) {
      // Empty quote line -> exit quote mode
      const newText = text.substring(0, lineStart) + indent + text.substring(actualLineEnd);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart + indent.length, lineStart + indent.length);
      }, 10);
      return true;
    }
    const insertion = `\n${indent}> `;
    const newText = text.substring(0, start) + insertion + text.substring(start);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
    return true;
  }

  return false;
}

/**
 * Handles standard formatting keyboard shortcuts:
 * - Ctrl/Cmd + B: Bold
 * - Ctrl/Cmd + I: Italic
 * - Ctrl/Cmd + Shift + X: Strikethrough
 * - Ctrl/Cmd + E: Inline Code
 */
export function handleFormattingShortcuts(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  textarea: HTMLTextAreaElement,
  text: string,
  setText: (newText: string) => void
): boolean {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (!isCtrlOrCmd) return false;

  const key = e.key.toLowerCase();

  // Bold (Ctrl+B)
  if (key === 'b') {
    e.preventDefault();
    applySmartFormatting(textarea, text, setText, 'bold');
    return true;
  }

  // Italic (Ctrl+I)
  if (key === 'i') {
    e.preventDefault();
    applySmartFormatting(textarea, text, setText, 'italic');
    return true;
  }

  // Strikethrough (Ctrl+Shift+X)
  if (e.shiftKey && key === 'x') {
    e.preventDefault();
    applySmartFormatting(textarea, text, setText, 'strikethrough');
    return true;
  }

  // Code (Ctrl+E)
  if (key === 'e') {
    e.preventDefault();
    applySmartFormatting(textarea, text, setText, 'code');
    return true;
  }

  return false;
}
