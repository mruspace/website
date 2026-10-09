import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Research log entries № 001 to № 004. Entries with a body get a page at
// /research/<slug>/; the others link out (external).
const research = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/research' }),
  schema: z.object({
    number: z.string().regex(/^\d{3}$/),
    kind: z.enum(['Paper', 'Results', 'Release', 'Note']),
    title: z.string(),
    /** Title in prev/next links. */
    shortTitle: z.string(),
    /** One line in the log. */
    summary: z.string(),
    lede: z.string().optional(),
    date: z.coerce.date(),
    /** Date as the log shows it when the day is not given, e.g. "May 2026". */
    dateLabel: z.string().optional(),
    updated: z.coerce.date().optional(),
    readingTime: z.string(),
    /** Second line of the log's right column, when it is not the reading time. */
    metaLabel: z.string().optional(),
    author: z.string().default('Will Binns'),
    doi: z.string().optional(),
    /** BibTeX, shown under "Cite this". */
    bibtex: z.string().optional(),
    /** A one-line citation, when there is no BibTeX. HTML allowed (<em>). */
    citeText: z.string().optional(),
    external: z.string().url().optional(),
    byline: z.array(z.object({ label: z.string(), text: z.string(), href: z.string().optional() })).default([]),
    sources: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    request: z
      .object({
        interest: z.enum(['field', 'flight', 'research', 'other']),
        topic: z.string(),
        heading: z.string(),
      })
      .optional(),
    featured: z
      .object({
        title: z.string(),
        summary: z.string(),
        line: z.string(),
        chart: z.enum(['flight-correct', 'dusk-output', 'dusk-sensitivity']),
        chartAlt: z.string(),
      })
      .optional(),
    /** Software: repository and language, for SoftwareSourceCode JSON-LD. */
    code: z.object({ repo: z.string().url(), language: z.string(), license: z.string() }).optional(),
  }),
});

export const collections = { research };
