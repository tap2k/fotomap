'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

/** Chips + text box. Enter or comma adds a tag; suggestions come from tags already in use. */
export default function TagInput({ value, onChange, suggestions = [], colors = {} }: { value: string[]; onChange: (tags: string[]) => void; suggestions?: string[]; colors?: Record<string, string> }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setText('');
  };
  const unused = suggestions.filter((s) => !value.includes(s));
  return (
    <div>
      <div className="input flex flex-wrap items-center gap-1.5 py-1.5">
        {value.map((t) => (
          <span key={t} className="chip bg-card">
            {colors[t] && <span className="h-2 w-2 rounded-full" style={{ background: colors[t] }} />}
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? '' : 'Add a tag…'}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none"
          aria-label="Add tag"
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unused.slice(0, 12).map((s) => (
            <button key={s} type="button" className="chip text-muted hover:bg-card" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
