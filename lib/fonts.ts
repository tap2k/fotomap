import { Lora, Nunito, Dancing_Script } from 'next/font/google';

// Heading fonts a project can pick (Design → Site). Self-hosted by next/font at build time.
const serif = Lora({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
const rounded = Nunito({ subsets: ['latin'], variable: '--font-rounded', display: 'swap' });
const script = Dancing_Script({ subsets: ['latin'], variable: '--font-script', display: 'swap' });

export const fontVariables = [serif.variable, rounded.variable, script.variable].join(' ');
