import type { Yacht } from '@/types/yacht';
import { priceShort, titleCase } from '@/lib/format';
import ImageGallery from './ImageGallery';
import SpecBadges from './SpecBadges';
import { Pin } from './icons';

/** The visual content of a swipe card (media + body). Drag is handled by parent. */
export default function YachtCard({ yacht }: { yacht: Yacht }) {
  return (
    <>
      <ImageGallery images={yacht.images} alt={yacht.name} />
      <div className="card__body">
        {yacht.destination && (
          <span className="card__loc">
            <Pin /> {titleCase(yacht.destination)}
          </span>
        )}
        <h2 className="card__name">{yacht.name}</h2>
        <div className="card__price">
          <b>{priceShort(yacht.priceFromEur)}</b>
          <span>per week</span>
        </div>
        {yacht.description && <p className="card__desc">{yacht.description}</p>}
        <SpecBadges yacht={yacht} />
      </div>
    </>
  );
}
