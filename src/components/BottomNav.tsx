'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, SearchIcon, Heart } from './icons';
import { usePreferences } from '@/store/usePreferences';

const TABS = [
  { href: '/', label: 'Discover', Icon: Compass },
  { href: '/search', label: 'Search', Icon: SearchIcon },
  { href: '/saved', label: 'Saved', Icon: Heart },
];

export default function BottomNav() {
  const pathname = usePathname();
  const savedCount = usePreferences((s) => s.likedIds.length);
  const hydrated = usePreferences((s) => s.hydrated);

  return (
    <nav className="tabbar">
      {TABS.map(({ href, label, Icon }) => {
        const on = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`tab${on ? ' on' : ''}`}>
            <Icon width={19} height={19} />
            {label}
            {href === '/saved' && hydrated && savedCount > 0 && (
              <span className="tab__count">{savedCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
