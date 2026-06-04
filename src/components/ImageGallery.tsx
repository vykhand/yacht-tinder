'use client';

import { useState } from 'react';

/**
 * In-card photo gallery. Tap the left/right thirds (or dots) to flip photos.
 * The whole card is draggable by the parent (framer-motion) — these are plain
 * clicks, so a drag won't trigger them.
 */
export default function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const n = Math.max(images.length, 1);
  const src = images[i];

  const go = (d: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setI((p) => (p + d + n) % n);
  };

  return (
    <div className="card__media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="card__img" src={src} alt={alt} draggable={false} loading="lazy" />
      <div className="card__scrim" />
      {n > 1 && (
        <>
          <div className="gallery-dots">
            {images.map((_, k) => (
              <span key={k} className={k === i ? 'on' : ''} />
            ))}
          </div>
          <button className="tap tap--l" onClick={(e) => go(-1, e)} aria-label="Previous photo" />
          <button className="tap tap--r" onClick={(e) => go(1, e)} aria-label="Next photo" />
        </>
      )}
    </div>
  );
}
