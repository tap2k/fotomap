'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import Modal from '@/components/Modal';
import Text from '@/components/Text';

/** "About" link that opens the project's about text in a pop-up. */
export default function AboutButton({ title, about, className = '', iconOnly = false }: { title: string; about: string; className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className} title="About">
        <Info size={16} />
        <span className={iconOnly ? 'hidden md:inline' : ''}>About</span>
      </button>
      {open && (
        <Modal title={`About ${title}`} onClose={() => setOpen(false)} wide>
          <Text text={about} className="leading-relaxed" />
        </Modal>
      )}
    </>
  );
}
