#!/usr/bin/env node
/**
 * Build-time sitemap generator. Emits dist/sitemap.xml from the top-level
 * routes plus every Learning Center article slug in learningRegistry.ts
 * (loaded through vite SSR like scripts/cases.mjs, so the TS source is the
 * single source of truth). Runs as part of `npm run build`;
 * staticwebapp.config.json and robots.txt both reference /sitemap.xml.
 */
import { createServer } from 'vite'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://retiregolden.app'

/** Crawlable routes without per-article slugs (app views like /plan are per-user). */
const STATIC_ROUTES = ['/', '/examples', '/disclaimer', '/learn', '/learn/glossary', '/learn/sources']

async function loadArticleSlugs() {
  const server = await createServer({
    root: appDir,
    configFile: join(appDir, 'vite.config.ts'),
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: { port: 30_000 + (process.pid % 20_000) } },
  })
  try {
    const registry = await server.ssrLoadModule('@retiregolden/planner-ui/learn/learningRegistry')
    return registry.LEARNING_ARTICLES.map((a) => a.slug)
  } finally {
    await server.close()
  }
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
