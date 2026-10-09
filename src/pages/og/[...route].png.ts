// Share cards, one per route, generated at build time: /og/<route>.png.
import type { APIRoute, GetStaticPaths } from 'astro';
import { renderCard } from '../../../scripts/og/card.mjs';
import { METADATA } from '../../data/metadata';

export const getStaticPaths: GetStaticPaths = () =>
  METADATA.map((m) => {
    const p = new URL(m.url).pathname.replace(/^\/|\/$/g, '');
    return { params: { route: p || 'index' }, props: { label: m.cardLabel, title: m.ogTitle } };
  });

export const GET: APIRoute = async ({ props }) => {
  const png = await renderCard(props as { label: string; title: string });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
