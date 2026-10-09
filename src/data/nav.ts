import { SITE } from './site';

export type NavId = 'field' | 'usecases' | 'flight' | 'how' | 'research' | 'docs' | 'company' | 'none';

export interface NavItem {
  id: NavId;
  label: string;
  href: string;
  ext?: boolean;
}

// Order and labels from the SiteHeader artboard.
export const MAIN_NAV: NavItem[] = [
  { id: 'field', label: 'Mru Field', href: '/field/' },
  { id: 'usecases', label: 'Use cases', href: '/use-cases/' },
  { id: 'flight', label: 'Mru Flight', href: '/flight/' },
  { id: 'how', label: 'How it works', href: '/how-it-works/' },
  { id: 'research', label: 'Research', href: '/research/' },
  { id: 'docs', label: 'Docs', href: `${SITE.docsUrl}/`, ext: true },
  { id: 'company', label: 'Company', href: '/company/' },
];

// Footer columns from the SiteFooter artboard.
export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Products',
    links: [
      { label: 'Mru Field', href: '/field/' },
      { label: 'Mru Flight', href: '/flight/' },
      { label: 'How it works', href: '/how-it-works/' },
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
      { label: 'All fifteen', href: '/use-cases/' },
    ],
  },
  {
    title: 'Research',
    links: [
      { label: 'The log', href: '/research/' },
      { label: 'Whitepaper', href: '/research/' },
      { label: 'Dusk', href: '/research/dusk-results/' },
      { label: 'Flight prototype', href: '/research/flight-prototype/' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/company/' },
      { label: 'Request information', href: '/contact/' },
      { label: 'Image credits', href: '/credits/' },
      { label: 'Terms', href: '/terms/' },
      { label: 'GitHub', href: SITE.github },
      { label: 'X', href: SITE.x },
    ],
  },
];
