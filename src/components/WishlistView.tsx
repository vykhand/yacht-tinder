'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Yacht } from '@/types/yacht';
import { usePreferences } from '@/store/usePreferences';
import { priceShort, titleCase } from '@/lib/format';
import { Close } from './icons';

export default function WishlistView() {
  const hydrated = usePreferences((s) => s.hydrated);
  const likedIds = usePreferences((s) => s.likedIds);
  const unsave = usePreferences((s) => s.unsave);
  const [all, setAll] = useState<Map<string, Yacht> | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/yachts')
      .then((r) => r.json())
      .then((list: Yacht[]) => {
        if (live) setAll(new Map(list.map((y) => [y.id, y])));
      })
      .catch(() => live && setAll(new Map()));
    return () => {
      live = false;
    };
  }, []);

  // Most recently liked first; only those we have data for.
  const yachts = useMemo(() => {
    if (!all) return [];
    return [...likedIds]
      .reverse()
      .map((id) => all.get(id))
      .filter((y): y is Yacht => !!y);
  }, [all, likedIds]);

  if (!hydrated || all === null) {
    return (
      <main className="main">
        <div className="center-col">
          <div className="spinner" />
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="search-head">
        <span className="eyebrow">your shortlist</span>
        <h1 className="headline">
          {yachts.length > 0 ? `${yachts.length} aboard` : 'Your berth is empty'}
        </h1>
      </div>

      {yachts.length === 0 ? (
        <div className="empty">
          <p>
            Swipe right (or tap the anchor) on the Discover deck to shortlist a yacht. Your saved
            charters gather here.
          </p>
        </div>
      ) : (
        <div className="saved-grid">
          {yachts.map((y) => (
            <a key={y.id} className="berth" href={y.url} target="_blank" rel="noreferrer">
              <button
                className="berth__x"
                onClick={(e) => {
                  e.preventDefault();
                  unsave(y.id);
                }}
                aria-label={`Remove ${y.name}`}
              >
                <Close width={15} height={15} />
              </button>
              {y.images[0] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={y.images[0]} alt={y.name} loading="lazy" />
              )}
              <div className="berth__scrim" />
              <div className="berth__body">
                <div className="berth__name">{y.name}</div>
                <div className="berth__meta">
                  {priceShort(y.priceFromEur)}/wk · {titleCase(y.destination)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
