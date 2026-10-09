// JSON-LD for every page: one @graph per page. Organization and WebSite on
// every page, then the types the Metadata board lists for the route. Every
// value comes from the same data the page shows (metadata.json, breadcrumbs,
// FAQ items, research frontmatter).
import type {
  AboutPage,
  Blog,
  BlogPosting,
  BreadcrumbList,
  CollectionPage,
  ContactPage,
  FAQPage,
  Organization,
  Person,
  ScholarlyArticle,
  Service,
  SoftwareApplication,
  SoftwareSourceCode,
  TechArticle,
  WebPage,
  WebSite,
  WithContext,
  Graph,
} from 'schema-dts';
import type { PageMeta } from './metadata';
import { SITE } from './site';

export interface Crumb {
  label: string;
  href?: string;
}
export interface Qa {
  q: string;
  a: string;
}

export interface PageLd {
  software?: { name: string; operatingSystem: string; category: string };
  service?: { name: string; serviceType: string };
  article?: {
    headline: string;
    datePublished: Date;
    dateModified?: Date;
    author: string;
    doi?: string;
    citation?: string[];
    code?: { repo: string; language: string; license: string };
  };
  blogPosts?: { headline: string; url: string; datePublished: Date }[];
  collection?: { name: string; url: string }[];
}

const ORG_ID = `${SITE.url}/#org`;
const SITE_ID = `${SITE.url}/#website`;
const FOUNDER_ID = `${SITE.url}/company/#founder`;
const abs = (href: string, base: string) => new URL(href, base).href;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const licenseUrl = (spdx: string) => `https://spdx.org/licenses/${spdx}.html`;

export const organization = (): Organization => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE.name,
  // The legal entity today. Becomes Mru Aerospace, Lda. after incorporation.
  legalName: SITE.legal,
  url: `${SITE.url}/`,
  logo: { '@type': 'ImageObject', url: `${SITE.url}/assets/icon-512.png`, width: '512', height: '512' },
  email: SITE.email,
  sameAs: [SITE.x, SITE.github, SITE.zenodo],
});

const website = (): WebSite => ({
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: SITE.name,
  url: `${SITE.url}/`,
  publisher: { '@id': ORG_ID },
  inLanguage: 'en',
});

const founder = (): Person => ({
  '@type': 'Person',
  '@id': FOUNDER_ID,
  name: 'Will Binns',
  jobTitle: 'Founder',
  worksFor: { '@id': ORG_ID },
  url: `${SITE.url}/company/`,
});

function breadcrumbs(items: Crumb[], pageUrl: string): BreadcrumbList {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: c.href ? abs(c.href, pageUrl) : pageUrl,
    })),
  };
}

const faqPage = (items: Qa[], url: string): FAQPage => ({
  '@type': 'FAQPage',
  url,
  mainEntity: items.map((q) => ({
    '@type': 'Question',
    name: q.q,
    acceptedAnswer: { '@type': 'Answer', text: q.a },
  })),
});

export interface GraphInput {
  meta: PageMeta;
  crumbs?: Crumb[];
  faq?: Qa[];
  ld?: PageLd;
}

export function buildGraph({ meta, crumbs, faq, ld = {} }: GraphInput): WithContext<Graph> | null {
  if (meta.schema.includes('noindex')) return null;
  const url = meta.url;
  const nodes: Graph['@graph'][number][] = [organization(), website()];
  const page = { name: meta.ogTitle, url, description: meta.description, isPartOf: { '@id': SITE_ID } };
  const need = <T>(v: T | undefined, what: string): T => {
    if (v === undefined) throw new Error(`JSON-LD: ${url} lists ${what} but the page passes no data for it`);
    return v;
  };

  for (const type of meta.schema) {
    switch (type) {
      case 'Organization':
      case 'WebSite':
        break; // on every page already
      case 'Person':
        nodes.push(founder());
        break;
      case 'BreadcrumbList':
        // Only when the page shows breadcrumbs: the list must match them.
        if (crumbs) nodes.push(breadcrumbs(crumbs, url));
        break;
      case 'FAQPage':
        nodes.push(faqPage(need(faq, 'FAQPage'), url));
        break;
      case 'SoftwareApplication': {
        const s = need(ld.software, 'SoftwareApplication');
        nodes.push({
          '@type': 'SoftwareApplication',
          name: s.name,
          description: meta.description,
          url,
          applicationCategory: s.category,
          operatingSystem: s.operatingSystem,
          publisher: { '@id': ORG_ID },
        } satisfies SoftwareApplication);
        break;
      }
      case 'Service': {
        const s = need(ld.service, 'Service');
        nodes.push({
          '@type': 'Service',
          name: s.name,
          serviceType: s.serviceType,
          description: meta.description,
          url,
          provider: { '@id': ORG_ID },
        } satisfies Service);
        break;
      }
      case 'TechArticle':
        nodes.push({
          '@type': 'TechArticle',
          headline: meta.ogTitle,
          description: meta.description,
          url,
          author: { '@id': ORG_ID },
          publisher: { '@id': ORG_ID },
          isPartOf: { '@id': SITE_ID },
          inLanguage: 'en',
        } satisfies TechArticle);
        break;
      case 'ScholarlyArticle':
      case 'BlogPosting': {
        const a = need(ld.article, type);
        const node = {
          '@type': type,
          headline: a.headline,
          description: meta.description,
          url,
          mainEntityOfPage: url,
          image: `${SITE.url}/og${new URL(url).pathname.replace(/\/$/, '')}.png`,
          author: { '@type': 'Person', '@id': FOUNDER_ID, name: a.author },
          publisher: { '@id': ORG_ID },
          datePublished: iso(a.datePublished),
          dateModified: iso(a.dateModified ?? a.datePublished),
          inLanguage: 'en',
          ...(a.doi ? { identifier: `https://doi.org/${a.doi}` } : {}),
          ...(a.citation?.length ? { citation: a.citation } : {}),
        };
        nodes.push(node as ScholarlyArticle | BlogPosting);
        break;
      }
      case 'SoftwareSourceCode': {
        const c = need(ld.article?.code, 'SoftwareSourceCode');
        nodes.push({
          '@type': 'SoftwareSourceCode',
          name: meta.ogTitle,
          codeRepository: c.repo,
          programmingLanguage: c.language,
          license: licenseUrl(c.license),
          author: { '@id': ORG_ID },
        } satisfies SoftwareSourceCode);
        break;
      }
      case 'CollectionPage':
        nodes.push({
          '@type': 'CollectionPage',
          ...page,
          hasPart: need(ld.collection, 'CollectionPage').map((c) => ({ '@type': 'WebPage', name: c.name, url: c.url })),
        } satisfies CollectionPage);
        break;
      case 'Blog':
        nodes.push({
          '@type': 'Blog',
          ...page,
          publisher: { '@id': ORG_ID },
          blogPost: need(ld.blogPosts, 'Blog').map((b) => ({
            '@type': 'BlogPosting',
            headline: b.headline,
            url: b.url,
            datePublished: iso(b.datePublished),
          })),
        } satisfies Blog);
        break;
      case 'AboutPage':
        nodes.push({ '@type': 'AboutPage', ...page, about: { '@id': ORG_ID } } satisfies AboutPage);
        break;
      case 'ContactPage':
        nodes.push({ '@type': 'ContactPage', ...page, about: { '@id': ORG_ID } } satisfies ContactPage);
        break;
      case 'WebPage':
        nodes.push({ '@type': 'WebPage', ...page } satisfies WebPage);
        break;
      default:
        throw new Error(`JSON-LD: no builder for type "${type}" (${url})`);
    }
  }
  return { '@context': 'https://schema.org', '@graph': nodes };
}
