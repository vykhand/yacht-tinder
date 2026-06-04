/* Thin line icons, drawn to match the maritime aesthetic. */
import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
});

export const Anchor = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7.2V21" />
    <path d="M5 12H19" />
    <path d="M5 12c0 4 3.4 7 7 7s7-3 7-7" />
    <path d="M5 12l-2 1.4M19 12l2 1.4" />
  </svg>
);

export const Compass = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </svg>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.5 16.5L21 21" />
  </svg>
);

export const Heart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 20s-7-4.6-9.3-9C1.2 8.2 2.6 5 5.8 5 8 5 9.4 6.4 12 9c2.6-2.6 4-4 6.2-4 3.2 0 4.6 3.2 3.1 6-2.3 4.4-9.3 9-9.3 9z" />
  </svg>
);

export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const Helm = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
  </svg>
);

export const Pin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 12, height: 12, ...p })}>
    <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);
