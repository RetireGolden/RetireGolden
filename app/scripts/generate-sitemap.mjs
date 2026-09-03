#!/usr/bin/env node
/**
 * Build-time sitemap generator. Emits dist/sitemap.xml from the top-level
 * routes (sitemapRoutes.mjs, pinned against the planner's route groups by
 * scripts/sitemapRoutes.test.mjs) plus every Learning Center article slug in
 * learningRegistry.ts (loaded through vite SSR like scripts/cases.mjs, so the
 * TS source is the single source of truth). Runs as part of `pnpm build`;
 * staticwebapp.config.json and robots.txt both reference /sitemap.xml.
 */
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

import { STATIC_ROUTES } from './sitemapRoutes.mjs'
import { appDir, withSsrModules } from './viteSsr.mjs'

const ORIGIN = 'https://retiregolden.app'

function loadArticleSlugs() {
  return withSsrModules({ registry: '@retiregolden/planner-ui/learn/learningRegistry' }, ({ registry }) =>
    registry.LEARNING_ARTICLES.map((a) => a.slug),
  )
}

/** Minimal XML escaping so a future slug with &, <, etc. can't break the document. */
const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const slugs = await loadArticleSlugs()
const urls = [...STATIC_ROUTES, ...slugs.sort().map((slug) => `/learn/${slug}`)]
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((path) => `  <url><loc>${escapeXml(`${ORIGIN}${path}`)}</loc></url>`),
  '</urlset>',
  '',
].join('\n')

const out = join(appDir, 'dist', 'sitemap.xml')
await writeFile(out, xml)
console.log(`sitemap: ${urls.length} URLs -> ${out}`)
