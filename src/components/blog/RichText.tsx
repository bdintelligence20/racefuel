import { strapiAssetUrl } from '../../services/strapi';

/**
 * Renders a Strapi rich-text body. Strapi v5's Rich Text (Blocks) field
 * returns a structured array; the legacy Rich Text (Markdown) field returns
 * a plain string. We render the Blocks shape natively and fall back to a
 * very small markdown subset for strings so we don't pull in a markdown
 * dependency for the v1 blog.
 */
type Block =
  | {
      type: 'paragraph' | 'heading' | 'quote' | 'list';
      level?: number;
      format?: 'ordered' | 'unordered';
      children: BlockChild[];
    }
  | { type: 'image'; image: { url: string; alternativeText?: string | null } }
  | { type: 'code'; children: BlockChild[] };

type BlockChild =
  | {
      type: 'text';
      text: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      code?: boolean;
    }
  | { type: 'link'; url: string; children: BlockChild[] }
  | { type: 'list-item'; children: BlockChild[] };

export function RichText({ body }: { body: string | unknown[] }) {
  if (Array.isArray(body)) {
    return <BlocksRenderer blocks={body as Block[]} />;
  }
  return <MarkdownFallback text={body} />;
}

function BlocksRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  if (block.type === 'paragraph') {
    return (
      <p className="mb-4">
        <Children nodes={block.children} />
      </p>
    );
  }
  if (block.type === 'heading') {
    const level = block.level ?? 2;
    const className =
      level <= 2
        ? 'text-[18px] font-display font-bold text-text-primary mt-8 mb-3'
        : 'text-[15px] font-display font-bold uppercase tracking-wider text-text-primary mt-6 mb-2';
    const Tag = (`h${Math.min(Math.max(level, 1), 6)}`) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return (
      <Tag className={className}>
        <Children nodes={block.children} />
      </Tag>
    );
  }
  if (block.type === 'list') {
    const ListTag = block.format === 'ordered' ? 'ol' : 'ul';
    const listClass =
      block.format === 'ordered'
        ? 'list-decimal list-outside pl-5 space-y-1.5 mb-4'
        : 'list-disc list-outside pl-5 space-y-1.5 mb-4';
    return (
      <ListTag className={listClass}>
        {block.children.map((child, i) => (
          <li key={i}>
            {child.type === 'list-item' ? <Children nodes={child.children} /> : null}
          </li>
        ))}
      </ListTag>
    );
  }
  if (block.type === 'quote') {
    return (
      <blockquote className="border-l-2 border-warm pl-4 italic text-text-secondary my-4">
        <Children nodes={block.children} />
      </blockquote>
    );
  }
  if (block.type === 'code') {
    return (
      <pre className="bg-surfaceHighlight border border-[var(--color-border)] rounded-lg p-3 text-[12px] overflow-x-auto mb-4">
        <code>
          <Children nodes={block.children} />
        </code>
      </pre>
    );
  }
  if (block.type === 'image') {
    const src = strapiAssetUrl(block.image as never);
    if (!src) return null;
    return (
      <img
        src={src}
        alt={block.image.alternativeText ?? ''}
        className="rounded-xl my-6 w-full h-auto"
      />
    );
  }
  return null;
}

function Children({ nodes }: { nodes: BlockChild[] }) {
  return (
    <>
      {nodes.map((node, i) => (
        <ChildNode key={i} node={node} />
      ))}
    </>
  );
}

function ChildNode({ node }: { node: BlockChild }) {
  if (node.type === 'text') {
    let el: React.ReactNode = node.text;
    if (node.code) el = <code className="bg-surfaceHighlight px-1 rounded text-[12px]">{el}</code>;
    if (node.bold) el = <strong>{el}</strong>;
    if (node.italic) el = <em>{el}</em>;
    if (node.underline) el = <u>{el}</u>;
    if (node.strikethrough) el = <s>{el}</s>;
    return <>{el}</>;
  }
  if (node.type === 'link') {
    return (
      <a
        href={node.url}
        className="text-warm hover:underline"
        target={node.url.startsWith('http') ? '_blank' : undefined}
        rel={node.url.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        <Children nodes={node.children} />
      </a>
    );
  }
  return null;
}

/** Very small markdown fallback: splits paragraphs on blank lines, renders
 *  inline bold/italic/links. Good enough for v1; swap in a real renderer if
 *  authors start writing long-form markdown. */
function MarkdownFallback({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4" dangerouslySetInnerHTML={{ __html: inlineMarkdown(p) }} />
      ))}
    </>
  );
}

function inlineMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-warm hover:underline">$1</a>',
    )
    .replace(/\n/g, '<br />');
}
