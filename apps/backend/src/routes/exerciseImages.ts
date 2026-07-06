import { FastifyInstance } from 'fastify';
import * as cheerio from 'cheerio';

interface SearchQuery {
  q?: string;
}

export interface ExerciseImageResult {
  id: string;
  url: string;
  description: string;
}

const SEARCH_URL = 'https://weighttraining.guide/?s=';
const MAX_RESULTS = 4;
const FETCH_TIMEOUT_MS = 8000;
const MAX_QUERY_WORDS = 5;

// Words that typically introduce a descriptive/equipment phrase (e.g. "on a
// rug", "with dumbbell hold") rather than naming the exercise itself. Once one
// of these is hit, everything from that point on is dropped — the search
// engine matches better on a short, canonical exercise name (e.g. "Dumbbell
// Step up") than on a full descriptive sentence (e.g. "Dumbbell Step-Ups on a
// rug"), and the LLM's query/exercise names often carry this kind of filler.
const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'on', 'in', 'at', 'to', 'of', 'for', 'with', 'without', 'using', 'use', 'while',
  'onto', 'into', 'from', 'by', 'holding', 'hold', 'over', 'under', 'near', 'your', 'and', 'or',
]);

/**
 * Reduces a free-form exercise name/query down to the strict minimum of words
 * the search engine needs: strips dashes/punctuation, cuts off at the first
 * filler word (dropping any trailing equipment/surface description), caps the
 * remaining word count, and naively singularizes plurals (e.g. "Ups" → "Up",
 * "Squats" → "Squat") so query and site content are more likely to match.
 */
function sanitizeSearchQuery(raw: string): string {
  const words = raw
    .replace(/[-_]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const fillerIndex = words.findIndex((w) => FILLER_WORDS.has(w.toLowerCase()));
  const core = fillerIndex === -1 ? words : words.slice(0, fillerIndex);
  const trimmed = (core.length > 0 ? core : words).slice(0, MAX_QUERY_WORDS);

  return trimmed
    .map((w) => {
      const lower = w.toLowerCase();
      return lower.length > 2 && lower.endsWith('s') && !lower.endsWith('ss') ? w.slice(0, -1) : w;
    })
    .join(' ');
}

/**
 * Runs server-side (not from the browser) because weighttraining.guide does not
 * send CORS headers, so a direct client-side fetch would be blocked. Scrapes
 * the site's own search results page: for each result article that is tagged
 * as an exercise (has an `a.category-link-exercises` link), grabs the first
 * image inside its `div.post-thumbnail-inner` thumbnail.
 *
 * The site's WAF returns 403 for requests whose User-Agent identifies as a bot
 * (e.g. a custom "...Bot/1.0" string) — it must look like an ordinary browser
 * request, so a real browser User-Agent + standard Accept/Accept-Language
 * headers are required here.
 */
async function fetchExerciseImages(query: string): Promise<ExerciseImageResult[]> {
  const sanitizedQuery = sanitizeSearchQuery(query) || query;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SEARCH_URL}${encodeURIComponent(sanitizedQuery)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://weighttraining.guide/',
      },
    });
    if (!response.ok) {
      throw new Error(`Search page request failed (HTTP ${response.status})`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: ExerciseImageResult[] = [];

    $('article.entry').each((_, el) => {
      if (results.length >= MAX_RESULTS) return;
      const article = $(el);
      const link = article.find('a.category-link-exercises').first();
      if (link.length === 0) return;

      const img = article.find('div.post-thumbnail-inner img').first();
      const src = img.attr('src') || img.attr('data-src');
      if (!src) return;

      const description = img.attr('alt')?.trim() || link.text().trim() || sanitizedQuery;
      results.push({ id: `${results.length}-${src}`, url: src, description });
    });

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

export async function exerciseImageRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get<{ Querystring: SearchQuery }>('/exercise-image-search', auth, async (request, reply) => {
    const query = request.query.q?.trim();
    if (!query) return reply.status(400).send({ error: 'q query parameter is required' });

    try {
      return await fetchExerciseImages(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      request.log.warn({ err, query }, 'exercise image search failed');
      return reply.status(502).send({ error: `Failed to fetch exercise images: ${message}` });
    }
  });
}
