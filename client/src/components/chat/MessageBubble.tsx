import React, { useState } from 'react';
import { FormattingFormat, MessageFormatting } from '../../types';
import { useChat } from '../../context/ChatContext';
import { Copy, Check } from 'lucide-react';

export interface MessageBubbleProps {
  content: string;
  format?: FormattingFormat;
  formatting?: MessageFormatting;
  className?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  format = 'markdown',
  className = ''
}) => {
  const { theme } = useChat() as any;
  const isDark = theme !== 'nordic';
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 1800);
  };

  // If plain format is requested, render without markdown parsing
  if (format === 'plain') {
    return (
      <div className={`text-body-md ${isDark ? 'text-[#F1F5F9]' : 'text-slate-900'} whitespace-pre-wrap ${className}`}>
        {content}
      </div>
    );
  }


  // Recursive inline parser for bold, italics, strikethrough, inline code, and mentions
  const parseInlineContent = (text: string, keyPrefix: string = 'k'): React.ReactNode[] => {
    if (!text) return [];

    // Match earliest delimiter:
    // 1. Markdown link: [text](url)
    // 2. Autolink URL: https://...
    // 3. Inline code: `...`
    // 4. Strikethrough: ~~...~~ or ~...~
    // 5. Bold: **...** or __...__
    // 6. Italic: *...* or _..._
    // 7. User mention: @handle
    const match = text.match(
      /(\[[^\]\n]+\]\([^\s)\n]+\))|(https?:\/\/[^\s<>"'\n]+)|(`[^`\n]+`)|(~~[^~\n]+~~)|(~[^~\n\s]+~)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n\s][^*\n]*\*)|(_[^_\n\s][^_\n]*_)|(@[a-zA-Z0-9_.-]+)/
    );

    if (!match || match.index === undefined) {
      return [text];
    }

    const matchIndex = match.index;
    const matchString = match[0];
    const before = text.slice(0, matchIndex);
    const after = text.slice(matchIndex + matchString.length);

    const nodes: React.ReactNode[] = [];
    if (before) {
      nodes.push(before);
    }

    // 1. Markdown link: [Title](url)
    if (matchString.startsWith('[') && matchString.includes('](') && matchString.endsWith(')')) {
      const closeBracket = matchString.indexOf('](');
      const linkTitle = matchString.slice(1, closeBracket);
      let linkHref = matchString.slice(closeBracket + 2, -1).trim();
      if (!linkHref.startsWith('http://') && !linkHref.startsWith('https://') && !linkHref.startsWith('mailto:')) {
        linkHref = `https://${linkHref}`;
      }
      nodes.push(
        <a
          key={`${keyPrefix}-link-${matchIndex}`}
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300 font-medium cursor-pointer transition-colors"
          title={linkHref}
        >
          {parseInlineContent(linkTitle, `${keyPrefix}-lt`)}
        </a>
      );
    }
    // 2. Raw Autolink URL: https://...
    else if (matchString.startsWith('http://') || matchString.startsWith('https://')) {
      nodes.push(
        <a
          key={`${keyPrefix}-url-${matchIndex}`}
          href={matchString}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300 font-medium cursor-pointer transition-colors break-all"
          title={matchString}
        >
          {matchString}
        </a>
      );
    }
    // 3. Inline code: `...`
    else if (matchString.startsWith('`') && matchString.endsWith('`')) {
      const code = matchString.slice(1, -1);
      nodes.push(
        <code
          key={`${keyPrefix}-code-${matchIndex}`}
          className={`px-1.5 py-0.5 rounded-[4px] font-mono text-[12px] leading-[16px] border font-normal select-all ${
            isDark ? 'bg-[#1E293B] text-blue-300 border-slate-700' : 'bg-slate-200/80 text-blue-700 border-slate-300'
          }`}
        >
          {code}
        </code>
      );
    }

    // 2. Strikethrough: ~~...~~ or ~...~
    else if (
      (matchString.startsWith('~~') && matchString.endsWith('~~') && matchString.length >= 4) ||
      (matchString.startsWith('~') && matchString.endsWith('~') && matchString.length >= 3)
    ) {
      const isDouble = matchString.startsWith('~~');
      const inner = isDouble ? matchString.slice(2, -2) : matchString.slice(1, -1);
      nodes.push(
        <del
          key={`${keyPrefix}-strike-${matchIndex}`}
          className="line-through decoration-slate-400 decoration-1 text-slate-400 dark:text-slate-400 opacity-90"
          title="Strikethrough"
        >
          {parseInlineContent(inner, `${keyPrefix}-s`)}
        </del>
      );
    }
    // 3. Bold: **...** or __...__
    else if (
      (matchString.startsWith('**') && matchString.endsWith('**')) ||
      (matchString.startsWith('__') && matchString.endsWith('__'))
    ) {
      const inner = matchString.slice(2, -2);
      nodes.push(
        <strong
          key={`${keyPrefix}-bold-${matchIndex}`}
          className={`font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-950 font-bold'}`}
          title="Bold"
        >
          {parseInlineContent(inner, `${keyPrefix}-b`)}
        </strong>
      );
    }
    // 4. Italic: *...* or _..._
    else if (
      (matchString.startsWith('*') && matchString.endsWith('*')) ||
      (matchString.startsWith('_') && matchString.endsWith('_'))
    ) {
      const inner = matchString.slice(1, -1);
      nodes.push(
        <em
          key={`${keyPrefix}-italic-${matchIndex}`}
          className={`font-normal ${isDark ? 'text-slate-200 italic' : 'text-slate-900 italic font-medium'}`}
          title="Italic"
        >
          {parseInlineContent(inner, `${keyPrefix}-i`)}
        </em>
      );
    }
    // 5. User Mention: @handle
    else if (matchString.startsWith('@')) {
      nodes.push(
        <span
          key={`${keyPrefix}-mention-${matchIndex}`}
          className={`px-1.5 py-0.5 rounded-[4px] font-mono text-[12px] font-medium border transition-colors cursor-pointer ${
            isDark
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30'
              : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200/70'
          }`}
        >
          {matchString}
        </span>
      );
    } else {
      nodes.push(matchString);
    }

    if (after) {
      nodes.push(...parseInlineContent(after, `${keyPrefix}-a`));
    }

    return nodes;
  };

  // Split content by multi-line code blocks first
  const codeBlockParts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`text-[13.5px] leading-[22px] select-text break-words ${isDark ? 'text-[#F1F5F9]' : 'text-slate-900'} ${className}`}>

      {codeBlockParts.map((part, partIdx) => {
        // Multi-line code block
        if (part.startsWith('```') && part.endsWith('```')) {
          const rawLines = part.slice(3, -3).replace(/^\n+|\n+$/g, '').split('\n');
          const firstLine = rawLines[0] || '';
          const hasLangHeader = /^[a-zA-Z0-9_#-]+$/.test(firstLine.trim());
          const language = hasLangHeader ? firstLine.trim() : '';
          const codeText = hasLangHeader ? rawLines.slice(1).join('\n') : rawLines.join('\n');
          const blockId = `cb-${partIdx}-${codeText.length}`;

          return (
            <div
              key={`cb-${partIdx}`}
              className="my-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/10 overflow-hidden font-mono text-xs shadow-xs"
            >
              <div className="px-3.5 py-1.5 bg-slate-200/70 dark:bg-black/30 border-b border-slate-300 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400 font-mono flex justify-between items-center select-none">
                <span className="uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                  {language || 'code'}
                </span>
                <button
                  onClick={() => handleCopyCode(codeText, blockId)}
                  className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-0.5 rounded-md hover:bg-slate-300/50 dark:hover:bg-white/10"
                  title="Copy code snippet"
                >
                  {copiedCodeId === blockId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-slate-900 dark:text-slate-100 leading-relaxed text-[12px] font-mono">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }

        // Lines within normal text: group contiguous quote blocks and render with high contrast
        const lines = part.split('\n');
        const elements: React.ReactNode[] = [];
        let lineIdx = 0;

        while (lineIdx < lines.length) {
          const currentLine = lines[lineIdx];

          // 1. Blockquote: support lines starting with '>' or '> ' and group contiguous lines
          if (currentLine.startsWith('>')) {
            const quoteLines: string[] = [];
            const startIdx = lineIdx;
            while (lineIdx < lines.length && lines[lineIdx].startsWith('>')) {
              quoteLines.push(lines[lineIdx].replace(/^>\s?/, ''));
              lineIdx++;
            }

            elements.push(
              <div
                key={`quote-${partIdx}-${startIdx}`}
                className={`pl-3.5 pr-3 py-2 my-2 border-l-[3.5px] rounded-r-lg italic text-[13px] leading-relaxed transition-colors shadow-2xs ${
                  isDark
                    ? 'border-emerald-400 bg-white/[0.06] text-slate-100'
                    : 'border-emerald-600 bg-black/[0.04] text-slate-950 font-medium'
                }`}
                style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
              >
                {quoteLines.map((qText, qIdx) => (
                  <div key={`ql-${qIdx}`} className="min-h-[1.25rem]">
                    {parseInlineContent(qText, `q-${partIdx}-${startIdx}-${qIdx}`)}
                  </div>
                ))}
              </div>
            );
            continue;
          }

          // 2. Bullet list: • or - or *
          if (currentLine.startsWith('• ') || currentLine.startsWith('- ') || currentLine.startsWith('* ')) {
            elements.push(
              <div
                key={`bl-${partIdx}-${lineIdx}`}
                className="flex items-start gap-2 pl-1.5 my-0.5"
              >
                <span className="text-emerald-500 font-bold select-none">•</span>
                <span
                  className={`flex-1 ${isDark ? 'text-slate-200' : 'text-slate-900 font-medium'}`}
                  style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}
                >
                  {parseInlineContent(currentLine.slice(2), `bl-${partIdx}-${lineIdx}`)}
                </span>
              </div>
            );
            lineIdx++;
            continue;
          }

          // 3. Numbered list: 1. 2. etc.
          const numMatch = currentLine.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            elements.push(
              <div
                key={`nl-${partIdx}-${lineIdx}`}
                className="flex items-start gap-2 pl-1.5 my-0.5"
              >
                <span className="text-emerald-500 font-mono text-xs font-semibold select-none min-w-[1.25rem]">
                  {numMatch[1]}.
                </span>
                <span
                  className={`flex-1 ${isDark ? 'text-slate-200' : 'text-slate-900 font-medium'}`}
                  style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}
                >
                  {parseInlineContent(numMatch[2], `nl-${partIdx}-${lineIdx}`)}
                </span>
              </div>
            );
            lineIdx++;
            continue;
          }

          // 4. Empty line spacer
          if (!currentLine.trim()) {
            elements.push(<div key={`sp-${partIdx}-${lineIdx}`} className="h-2" />);
            lineIdx++;
            continue;
          }

          // 5. Standard line
          elements.push(
            <div
              key={`ln-${partIdx}-${lineIdx}`}
              className={`min-h-[1.375rem] ${isDark ? 'text-[#F1F5F9]' : 'text-slate-900'}`}
              style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
            >
              {parseInlineContent(currentLine, `ln-${partIdx}-${lineIdx}`)}
            </div>
          );
          lineIdx++;
        }

        return (
          <div key={`part-${partIdx}`} className="space-y-1">
            {elements}
          </div>
        );
      })}
    </div>
  );
};
