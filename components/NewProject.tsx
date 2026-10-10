'use client';

import { useState } from 'react';
import { BookOpen, Camera, Map, MapPinned, Mic, Plus } from 'lucide-react';
import Modal from '@/components/Modal';
import NewChannel from '@/components/NewChannel';
import { TEMPLATES } from '@/lib/templates';

const ICONS = { map: Map, photovoice: Camera, mapping: MapPinned, 'oral-history': Mic, story: BookOpen } as const;

/** "New project" → pick a starting point → name it. */
export default function NewProject({ big = false }: { big?: boolean }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  const t = TEMPLATES.find((x) => x.id === template)!;
  return (
    <>
      {big ? (
        <button onClick={() => setOpen(true)} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent">
          <Plus size={28} /> New project
        </button>
      ) : (
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New project
        </button>
      )}
      {open && (
        <Modal title="New project" onClose={() => setOpen(false)} wide>
          <p className="mb-3 text-sm text-muted">Pick a starting point. You can change everything later.</p>
          <div className="mb-5 grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((x) => {
              const Icon = ICONS[x.id as keyof typeof ICONS] ?? Map;
              const active = x.id === template;
              return (
                <button key={x.id} onClick={() => setTemplate(x.id)} className={`card flex gap-3 p-3 text-left ${active ? 'border-accent ring-2 ring-accent' : 'hover:bg-card'}`} aria-pressed={active}>
                  <Icon size={22} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="block font-medium">{x.name}</span>
                    <span className="text-sm text-muted">{x.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <NewChannel key={t.id} settings={t.settings} description={t.description} placeholder={`Name your ${t.name.toLowerCase()}`} autoFocus />
        </Modal>
      )}
    </>
  );
}
