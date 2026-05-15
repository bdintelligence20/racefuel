import type { ReactNode } from 'react';

/**
 * Minimal Markdown → JSX renderer for the blog body.
 *
 * Why hand-rolled: we don't want to ship a markdown lib + sanitiser for a
 * single content surface. By emitting React nodes (never `dangerouslySetInnerHTML`)
 * we get XSS safety for free — every string passes through React's text-escaping.
 *
 * Supports: ATX headings (h1-h3), paragraphs, bold (`**x**`), italic (`*x*`),
 * inline code (`` `x` ``), links (`[t](url)`), images (`![alt](url)`),
 * ordered + unordered lists, fenced code blocks (```), and blockquotes (>).
 *
 * Tables, footnotes, raw HTML — not supported. Add when content needs them.
 */

interface InlineProps {
  text: string;
}

function renderInline(text: string): ReactNode[] {
  // Inline pattern order: image, link, code, bold, italic. We walk left to
  // right, slicing as we go — keeps nesting predictable (no italic-inside-bold
  // weirdness, which is fine for blog prose).
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const patterns: Array<{
    regex: RegExp;
    render: (m: RegExpExecArray) => ReactNode;
  }> = [
    {
      regex: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/y,
      render: (m) => (
        <img
          key={`md-${key++}`}
          src={m[2]}
          alt={m[1]}
          title={m[3]}
          loading="lazy"
          className="my-6 rounded-xl border border-[var(--color-border)] max-w-full h-auto"
        />
      ),
    },
    {
      regex: /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/y,
      render: (m) => (
        <a
          key={`md-${key++}`}
          href={m[2]}
          title={m[3]}
          target={m[2].startsWith('http') ? '_blank' : undefined}
          rel={m[2].startsWith('http') ? 'noopener noreferrer' : undefined}
          className="text-accent hover:text-accent-light underline underline-offset-2"
        >
          {renderInline(m[1])}
        </a>
      ),
    },
    {
      regex: /`([^`]+)`/y,
      render: (m) => (
        <code
          key={`md-${key++}`}
          className="px-1.5 py-0.5 rounded bg-surfaceHighlight border border-[var(--color-border)] font-mono text-[0.92em]"
        >
          {m[1]}
        </code>
      ),
    },
    {
      regex: /\*\*([^*]+)\*\*/y,
      render: (m) => <strong key={`md-${key++}`} className="font-bold text-text-primary">{renderInline(m[1])}</strong>,
    },
    {
      regex: /\*([^*]+)\*/y,
      render: (m) => <em key={`md-${key++}`} className="italic">{renderInline(m[1])}</em>,
    },
  ];

  let buf = '';
  const flushBuf = () => {
    if (buf.length === 0) return;
    out.push(buf);
    buf = '';
  };

  while (i < text.length) {
    let matched = false;
    for (const { regex, render } of patterns) {
      regex.lastIndex = i;
      const m = regex.exec(text);
      if (m && m.index === i) {
        flushBuf();
        out.push(render(m));
        i = regex.lastIndex;
        matched = true;
        break;
      }
    }
    if (!matched) {
      buf += text[i];
      i++;
    }
  }
  flushBuf();
  return out;
}

export function Inline({ text }: InlineProps) {
  return <>{renderInline(text)}</>;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block.
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // closing ```
      blocks.push(
        <pre
          key={`md-${key++}`}
          className="my-5 px-4 py-3.5 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] overflow-x-auto"
        >
          <code className={`font-mono text-[13px] leading-relaxed text-text-primary ${lang ? `language-${lang}` : ''}`}>
            {codeLines.join('\n')}
          </code>
        </pre>
      );
      continue;
    }

    // Heading.
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const cls =
        level === 1
          ? 'text-3xl font-display font-black text-text-primary mt-8 mb-3'
          : level === 2
            ? 'text-2xl font-display font-bold text-text-primary mt-7 mb-2.5'
            : 'text-xl font-display font-bold text-text-primary mt-6 mb-2';
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');
      blocks.push(
        <Tag key={`md-${key++}`} className={cls}>
          <Inline text={text} />
        </Tag>
      );
      i++;
      continue;
    }

    // Blockquote — collapses contiguous '> ' lines.
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`md-${key++}`}
          className="my-5 pl-4 border-l-4 border-accent/40 text-text-secondary italic"
        >
          <Inline text={quoteLines.join(' ')} />
        </blockquote>
      );
      continue;
    }

    // Unordered list.
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`md-${key++}`} className="my-4 ml-6 list-disc space-y-1.5 text-text-primary">
          {items.map((it, idx) => (
            <li key={idx}><Inline text={it} /></li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`md-${key++}`} className="my-4 ml-6 list-decimal space-y-1.5 text-text-primary">
          {items.map((it, idx) => (
            <li key={idx}><Inline text={it} /></li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph — gather until blank line or block-start.
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('```') &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`md-${key++}`} className="my-4 leading-relaxed text-text-primary">
        <Inline text={paraLines.join(' ')} />
      </p>
    );
  }

  return <div className="text-[15.5px] text-text-primary">{blocks}</div>;
}
