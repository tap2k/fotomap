import { Lora, Nunito, Damion } from 'next/font/google';

// Heading fonts a project can pick (Design → Site). Self-hosted by next/font at build time.
const serif = Lora({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
const rounded = Nunito({ subsets: ['latin'], variable: '--font-rounded', display: 'swap' });
const script = Damion({ weight: '400', subsets: ['latin'], variable: '--font-script', display: 'swap' });

export const fontVariables = [serif.variable, rounded.variable, script.variable].join(' ');
