import type { Yacht } from '@/types/yacht';
import { specItems } from '@/lib/format';

export default function SpecBadges({ yacht }: { yacht: Yacht }) {
  return (
    <div className="specs">
      {specItems(yacht).map((s) => (
        <span className="spec" key={s.label}>
          <b>{s.value}</b>
          <span>{s.label}</span>
        </span>
      ))}
    </div>
  );
}
