// mru.space settings for scripts/seo/postbuild.mjs.
import { readFileSync } from 'node:fs';

// The docs pages, for the "Docs" section of llms.txt. Source of truth:
// mruspace/docs src/data/metadata.json (copied here).
const docs = JSON.parse(readFileSync('src/data/docs-metadata.json', 'utf8'));

export default {
  metadata: 'src/data/metadata.json',
  siteName: 'Mru Aerospace',
  mainSelector: 'main',
  // Interactive or decorative parts with no meaning as text.
  drop: [
    'script',
    'style',
    'button',
    'form',
    '.mark-anim',
    '.mark-static',
    '[data-quorum]',
    '.seam',
    '.plate .no',
    '.theme-switch',
  ],
  title: 'Mru',
  summary:
    'Mru is fault-tolerant software for computers that cannot be repaired in time: ocean observatories, offshore and remote sites, spacecraft. When processors fail, it keeps delivering checked results on the ones left. Early: decision core at TRL 3, open source, first field pilot planned for 2027.',
  intro:
    'Two products share one open core: Mru Field for unattended equipment on Earth, and Mru Flight for spacecraft. Dusk and Mru 2049 are research. Every number on the site has a source; limits are stated next to claims. Contact: contact@mru.space or https://mru.space/contact/.',
  sections: [
    { title: 'Products', match: (p) => ['/', '/field/', '/flight/', '/how-it-works/'].includes(p) },
    { title: 'Use cases', match: (p) => p.startsWith('/use-cases/') },
    { title: 'Research', match: (p) => p.startsWith('/research/') },
    {
      title: 'Docs',
      links: [
        {
          title: 'Mru docs, llms.txt',
          url: 'https://docs.mru.space/llms.txt',
          description: 'The docs site index for language models.',
        },
        ...docs.map((d) => ({
          title: d.title.replace(/ · Mru Docs$/, ''),
          url: `${d.url.replace(/\/$/, '')}/index.md`,
          description: d.description,
        })),
      ],
    },
    { title: 'Company', match: (p) => ['/company/', '/contact/', '/credits/', '/terms/'].includes(p) },
  ],
};
