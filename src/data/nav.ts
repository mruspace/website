import { SITE } from './site';

export type NavId = 'field' | 'usecases' | 'flight' | 'how' | 'research' | 'docs' | 'company' | 'none';

export interface NavItem {
  id: NavId;
  label: string;
  href: string;
}

// Order and labels from the SiteHeader artboard.
export const MAIN_NAV: NavItem[] = [
  { id: 'field', label: 'Mru Field', href: '/field/' },
  { id: 'flight', label: 'Mru Flight', href: '/flight/' },
  { id: 'research', label: 'Research', href: '/research/' },
  { id: 'docs', label: 'Docs', href: `${SITE.docsUrl}/` },
];

// Footer columns from the SiteFooter artboard.
export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Products',
    links: [
      { label: 'Mru Field', href: '/field/' },
      { label: 'Mru Flight', href: '/flight/' },
      { label: 'Architecture', href: '/architecture/' },
      { label: 'Docs', href: `${SITE.docsUrl}/` },
    ],
  },
  {
    title: 'Use cases',
    links: [
      { label: 'Deep-sea observatories', href: '/use-cases/deep-sea-observatories/' },
      { label: 'Ocean buoys', href: '/use-cases/ocean-buoys/' },
      { label: 'Offshore wind', href: '/use-cases/offshore-wind/' },
      { label: 'Polar stations', href: '/use-cases/polar-stations/' },
      { label: 'More use cases', href: '/use-cases/' },
    ],
  },
  {
    title: 'Research',
    links: [
      { label: 'Log', href: '/research/' },
      { label: 'Whitepaper', href: '/research/' },
      { label: 'Dusk', href: '/research/dusk-results/' },
      { label: 'Flight prototype', href: '/research/flight-prototype/' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/company/' },
      { label: 'Get in touch', href: '/contact/' },
      { label: 'Credits', href: '/credits/' },
      { label: 'Brand', href: '/brand/' },
      { label: 'Terms', href: '/terms/' },
      { label: 'GitHub', href: SITE.github },
      { label: 'X', href: SITE.x },
    ],
  },
];
