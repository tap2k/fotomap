import { Fragment } from 'react';

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Plain text with paragraphs, line breaks and clickable links. No HTML is ever injected. */
export default function Text({ text, className = '' }: { text: string; className?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className={`prose-lite ${className}`}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split('\n').map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {line.split(URL_RE).map((part, k) =>
                k % 2 ? (
                  <a key={k} href={part} target="_blank" rel="noopener noreferrer nofollow">
                    {part}
                  </a>
                ) : (
                  part
                ),
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
