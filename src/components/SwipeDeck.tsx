'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import type { Yacht, RankedYacht } from '@/types/yacht';
import { usePreferences } from '@/store/usePreferences';
import YachtCard from './YachtCard';
import { Anchor, Close } from './icons';

const THRESHOLD = 110;
const VELOCITY = 700;

type Dir = 'like' | 'pass';
interface CardHandle {
  swipe: (dir: Dir) => void;
}

/* -- the top, draggable card -------------------------------------------------*/
const SwipeCard = forwardRef<CardHandle, { yacht: Yacht; onDecide: (dir: Dir) => void }>(
  function SwipeCard({ yacht, onDecide }, ref) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-240, 240], [-13, 13]);
    const opacity = useTransform(x, [-620, -340, 0, 340, 620], [0, 1, 1, 1, 0]);
    const ayeOpacity = useTransform(x, [24, 150], [0, 1]);
    const passOpacity = useTransform(x, [-150, -24], [1, 0]);

    const fly = useCallback(
      (dir: Dir) => {
        animate(x, dir === 'like' ? 640 : -640, {
          type: 'spring',
          stiffness: 220,
          damping: 28,
          onComplete: () => onDecide(dir),
        });
      },
      [x, onDecide],
    );

    useImperativeHandle(ref, () => ({ swipe: fly }), [fly]);

    const onDragEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.x > THRESHOLD || info.velocity.x > VELOCITY) fly('like');
      else if (info.offset.x < -THRESHOLD || info.velocity.x < -VELOCITY) fly('pass');
      else animate(x, 0, { type: 'spring', stiffness: 350, damping: 30 });
    };

    return (
      <motion.div
        className="card"
        style={{ x, rotate, opacity, zIndex: 10 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={onDragEnd}
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <motion.span className="stamp stamp--aye" style={{ opacity: ayeOpacity }}>
          <Anchor width={30} height={30} /> Aye
        </motion.span>
        <motion.span className="stamp stamp--pass" style={{ opacity: passOpacity }}>
          Pass
        </motion.span>
        <YachtCard yacht={yacht} />
      </motion.div>
    );
  },
);

/* -- the deck ----------------------------------------------------------------*/
export default function SwipeDeck() {
  const hydrated = usePreferences((s) => s.hydrated);
  const likedIds = usePreferences((s) => s.likedIds);
  const skippedIds = usePreferences((s) => s.skippedIds);
  const like = usePreferences((s) => s.like);
  const skip = usePreferences((s) => s.skip);
  const reset = usePreferences((s) => s.reset);

  const [deck, setDeck] = useState<Yacht[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const topRef = useRef<CardHandle>(null);
  const fetching = useRef(false);
  const lastLoadAt = useRef(-1); // swiped-count at last reload (prevents loops)

  const loadDeck = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const { likedIds: l, skippedIds: s } = usePreferences.getState();
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ likedIds: l, dislikedIds: s, limit: 50 }),
      });
      const data = (await res.json()) as { deck: RankedYacht[] };
      const fresh = data.deck.map((r) => r.yacht);
      setDeck(fresh);
      setDone(fresh.length === 0);
    } catch {
      /* leave deck as-is; user can retry by swiping/reloading */
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, []);

  // Initial load + re-rank toward taste when the deck runs low.
  const swiped = likedIds.length + skippedIds.length;
  useEffect(() => {
    if (!hydrated || done) return;
    if (deck.length <= 3 && !fetching.current && swiped !== lastLoadAt.current) {
      lastLoadAt.current = swiped;
      loadDeck();
    }
  }, [hydrated, done, deck.length, swiped, loadDeck]);

  const commit = (dir: Dir, id: string) => {
    if (dir === 'like') like(id);
    else skip(id);
    setDeck((d) => d.slice(1));
  };

  const handleReset = () => {
    reset();
    setDone(false);
    lastLoadAt.current = -999;
    setDeck([]);
  };

  if (!hydrated || (loading && deck.length === 0 && !done)) {
    return (
      <div className="deck-wrap">
        <div className="deck">
          <div className="center-col">
            <div className="spinner" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-wrap">
      <div className="deck">
        {deck.length === 0 || done ? (
          <div className="deck__empty">
            <span className="eyebrow">end of the marina</span>
            <h2 className="headline">The whole fleet, seen.</h2>
            <p style={{ color: 'var(--ivory-dim)', fontSize: 14, maxWidth: '28ch', margin: '0 auto' }}>
              You&apos;ve swiped through every yacht. Reset to start over, or check your shortlist.
            </p>
            <button className="chip" style={{ marginTop: 6 }} onClick={handleReset}>
              ↺ reset the deck
            </button>
          </div>
        ) : (
          deck
            .slice(0, 3)
            .map((y, idx) =>
              idx === 0 ? (
                <SwipeCard key={y.id} ref={topRef} yacht={y} onDecide={(dir) => commit(dir, y.id)} />
              ) : (
                <div
                  key={y.id}
                  className="card"
                  style={{
                    transform: `scale(${1 - idx * 0.045}) translateY(${idx * 12}px)`,
                    zIndex: 9 - idx,
                    pointerEvents: 'none',
                    filter: `brightness(${1 - idx * 0.16})`,
                  }}
                >
                  <YachtCard yacht={y} />
                </div>
              ),
            )
            .reverse()
        )}
      </div>

      {!done && deck.length > 0 && (
        <div className="controls">
          <button
            className="fab fab--lg fab--pass"
            onClick={() => topRef.current?.swipe('pass')}
            aria-label="Pass"
          >
            <Close width={26} height={26} />
          </button>
          <button
            className="fab fab--lg fab--aye"
            onClick={() => topRef.current?.swipe('like')}
            aria-label="Save to shortlist"
          >
            <Anchor width={26} height={26} />
          </button>
        </div>
      )}
    </div>
  );
}
