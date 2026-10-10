import { Fragment, type ReactNode } from 'react';

// [label](url) | **bold** | *italic* | bare url. Rendered as React nodes; no HTML is ever injected.
const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

const link = (href: string, label: ReactNode, key: number) => (
  <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
    {label}
  </a>
);

function inline(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1]) out.push(link(m[2], m[1], k++));
    else if (m[3]) out.push(<strong key={k++}>{m[3]}</strong>);
    else if (m[4]) out.push(<em key={k++}>{m[4]}</em>);
    else out.push(link(m[5], m[5], k++));
    last = m.index + m[0].length;
  }
  out.push(line.slice(last));
  return out;
}

/** Plain text with paragraphs, line breaks, links and a little Markdown (bold, italic, [links](…)). */
export default function Text({ text, className = '' }: { text: string; className?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className={`prose-lite ${className}`}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split('\n').map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(line.replace(/^#{1,6}\s+/, ''))}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
