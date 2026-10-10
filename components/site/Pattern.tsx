/** Decorative band (e.g. a folk-art border) used at the top of story panels and the About pop-up. */
export default function Pattern({ url, className = 'h-12' }: { url?: string; className?: string }) {
  if (!url) return null;
  return <div aria-hidden className={`w-full bg-repeat-x ${className}`} style={{ backgroundImage: `url(${JSON.stringify(url)})`, backgroundSize: 'auto 100%' }} />;
}
