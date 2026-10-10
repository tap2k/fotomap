'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import Modal from '@/components/Modal';
import Text from '@/components/Text';
import Pattern from '@/components/site/Pattern';

/** "About" link that opens the project's about text in a pop-up. */
export default function AboutButton({ title, about, pattern, className = '', iconOnly = false }: { title: string; about: string; pattern?: string; className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className} title="About">
        <Info size={16} />
        <span className={iconOnly ? 'hidden md:inline' : ''}>About</span>
      </button>
      {open && (
        <Modal title={`About ${title}`} onClose={() => setOpen(false)} wide>
          <Pattern url={pattern} className="-mx-5 -mt-2 mb-4 h-16 !w-[calc(100%+2.5rem)]" />
          <Text text={about} className="leading-relaxed" />
        </Modal>
      )}
    </>
  );
}
