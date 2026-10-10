'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Search } from 'lucide-react';

type Place = { label: string; lat: number; lng: number };
const GEOCODER = process.env.NEXT_PUBLIC_GEOCODER_URL ?? 'https://photon.komoot.io/api/';

/** Type a place or address (OpenStreetMap via Photon), or use the device location. */
export default function PlaceSearch({ onPick, placeholder = 'Search for a place or address' }: { onPick: (p: Place) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [locating, setLocating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 3) return setResults([]);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${GEOCODER}?q=${encodeURIComponent(q)}&limit=5`);
        const data = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
        setResults(
          data.features.map((f) => {
            const p = f.properties;
            return {
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              label: [p.name, p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street, p.city ?? p.county, p.country].filter(Boolean).join(', '),
            };
          }),
        );
      } catch {
        setResults([]);
      }
    }, 350);
  }, [q]);

  const pick = (p: Place) => {
    onPick(p);
    setQ('');
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </div>
        <button
          type="button"
          className="btn shrink-0"
          title="Use my location"
          disabled={locating}
          onClick={() => {
            setLocating(true);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setLocating(false);
                pick({ label: 'My location', lat: pos.coords.latitude, lng: pos.coords.longitude });
              },
              () => setLocating(false),
              { enableHighAccuracy: true, timeout: 10000 },
            );
          }}
        >
          <LocateFixed size={16} />
          <span className="hidden sm:inline">{locating ? 'Locating…' : 'My location'}</span>
        </button>
      </div>
      {results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-bg shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-card" onClick={() => pick(r)}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
