import type { GeminiComposition, NationalFilm } from "@/types/movies";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

type GeminiScope = "list" | "detail";

interface StyleOptions {
  scope: GeminiScope;
  prompt: string;
  movies?: NationalFilm[];
  highlight?: NationalFilm | null;
  movie?: NationalFilm | null;
}

interface GeminiTextPart {
  text?: string;
}

interface GeminiCandidateContent {
  parts?: GeminiTextPart[];
}

interface GeminiCandidate {
  content?: GeminiCandidateContent;
}

interface GeminiSuccessResponse {
  candidates: GeminiCandidate[];
}

const MAX_MOVIES_FOR_PROMPT = 12;

const baseGuidelines = `You are Gemini 2.0 Flash collaborating on a Next.js app that showcases the U.S. National Film Registry. Reply ONLY with valid JSON matching this TypeScript signature:
{
  "html": string;
  "css": string;
  "notes": string[];
}

Rules:
- html must be a fragment (no <html>, <body>, or <head> wrappers).
- Do not include <style> tags or <script> tags inside html.
- css should be scoped but can safely target body, :root, etc.
- notes is a short array of design choices to surface in the UI.
- Never wrap the JSON inside markdown fences or commentary.`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function simplifyMovie(movie: NationalFilm) {
  return {
    slug: movie.slug,
    title: movie.title,
    releaseYear: movie.releaseYear,
    registryYear: movie.registryYear,
    runtimeMinutes: movie.runtimeMinutes,
    genres: movie.genres,
    logline: movie.logline,
    summary: movie.summary,
    whyImportant: movie.whyImportant,
    watchUrl: movie.watchUrl,
    directors: movie.directors,
    cast: movie.cast,
  };
}

export function composePrompt({ scope, prompt, movies, highlight, movie }: StyleOptions): string {
  if (scope === "detail" && movie) {
    const movieBlob = JSON.stringify(simplifyMovie(movie), null, 2);
    return `${baseGuidelines}

User prompt or requested mood:
${prompt}

Context:
- This is the dossier/detail page for a single registry film.
- Blend archival reverence with experimental design as desired, but keep it readable.
- Mention the film title prominently, cite at least one reason it matters, and highlight the provided Library of Congress link.
- IMPORTANT: If specific data fields (like 'cast', 'whyImportant', 'summary') are empty strings or empty arrays in the provided metadata, DO NOT create sections for them. Only display data that actually exists.

Film metadata to weave into markup:
${movieBlob}

Deliver JSON with html/css/notes.`;
  }

  const trimmedMovies = (movies ?? []).slice(0, MAX_MOVIES_FOR_PROMPT).map(simplifyMovie);
  const movieBlob = JSON.stringify(trimmedMovies, null, 2);
  const highlightBlob = highlight ? JSON.stringify(simplifyMovie(highlight), null, 2) : "null";

  return `${baseGuidelines}

User prompt or requested mood:
${prompt}

Context:
- This is the landing page that lists multiple registry films and features a \"spin the reel\" random selector.
- Include a hero/intro, the random selector, and the grid/list of every provided film.
- The UI refreshes every five minutes via incremental static regeneration, so lean into bold ever-changing layouts.

Film dataset (trimmed to ${trimmedMovies.length} entries):
${movieBlob}

Highlighted film (initial random selection):
${highlightBlob}

Accessibility + integration requirements:
1. Provide an element with attribute data-random-panel. Inside it, include children with attributes data-random-title, data-random-meta, data-random-logline, and data-random-link (an <a> tag). We will hydrate these nodes client-side.
2. Provide a button (or button-like element) with attribute data-random-button to trigger another random pick.
3. For each movie card in the grid, include a link to /movies/{slug}.
4. Feel free to introduce additional sections (style notes, registry facts, etc.) as long as they stem from the data and prompt.

Return only the JSON payload.`;
}

function extractJsonFromText(text: string): string | null {
  if (!text) {
    return null;
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function normalizeHtmlFragment(html: string): string {
  if (!html) {
    return "";
  }

  return html
    .replace(/\bclassName=/g, "class=")
    .replace(/\bhtmlFor=/g, "for=")
    .replace(/\sdata-([\w]+)=/g, (match) => match.toLowerCase());
}

function ensureRandomButtonAttribute(html: string): string {
  // Check if there's already a data-random-button attribute
  if (html.includes('data-random-button')) {
    return html;
  }

  // Fix all types of malformed HTML in one comprehensive pass
  // 1. Fix self-closing spans: <span ... /> -> <span ...></span>
  html = html.replace(/<span([^>]*?)\s*\/>/gi, '<span$1></span>');

  // 2. Fix spans with /> in content: <span>Content /> -> <span>Content</span>
  html = html.replace(/<span([^>]*?)>(.*?)\s*\/>/gi, '<span$1>$2</span');

  // 3. Fix self-closing button tags: <button ... /> -> <button ...></button>
  html = html.replace(/<button([^>]*?)\s*\/>/gi, '<button$1></button>');

  // 4. Fix buttons with /> in content: <button>Content /> -> <button>Content</button>
  html = html.replace(/<button([^>]*?)>(.*?)\s*\/>/gi, '<button$1>$2</button>');

  // Now add the data-random-button attribute to buttons with relevant keywords
  // Use a more permissive regex that works even with nested tags
  return html.replace(
    /<button([^>]*?)>([\s\S]*?)<\/button>/gi,
    (match, attributes, content) => {
      // Check if this button is about spinning/random selection
      const lowerContent = content.toLowerCase();
      const lowerAttrs = attributes.toLowerCase();

      if ((lowerContent.includes('spin') || lowerContent.includes('random') ||
        lowerContent.includes('reel') || lowerContent.includes('discover') ||
        lowerContent.includes('another')) && !lowerAttrs.includes('data-random-button')) {
        // Add the data-random-button attribute
        return `<button${attributes} data-random-button>${content}</button>`;
      }
      return match;
    }
  );
}


function isGeminiResponse(body: unknown): body is GeminiSuccessResponse {
  if (!body || typeof body !== "object" || !("candidates" in body)) {
    return false;
  }

  const { candidates } = body as { candidates?: unknown };
  return Array.isArray(candidates);
}

function parseGeminiResponse(body: unknown): GeminiComposition | null {
  if (!isGeminiResponse(body)) {
    return null;
  }

  const text =
    body.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text ?? "")
      .join(" ")
      .trim() ?? "";

  if (!text) {
    return null;
  }

  const sanitized = extractJsonFromText(text);
  if (!sanitized) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(sanitized);
    if (
      parsed &&
      typeof parsed === "object" &&
      "html" in parsed &&
      "css" in parsed &&
      "notes" in parsed
    ) {
      const { html, css, notes } = parsed as {
        html: unknown;
        css: unknown;
        notes: unknown;
      };

      if (typeof html !== "string" || typeof css !== "string" || !Array.isArray(notes)) {
        return null;
      }

      const filteredNotes = notes.filter((note): note is string => typeof note === "string");
      return {
        html: ensureRandomButtonAttribute(normalizeHtmlFragment(html)),
        css,
        notes: filteredNotes,
      };
    }
  } catch (error) {
    console.warn("Failed to parse Gemini JSON. Raw text:", text, error);
    return null;
  }

  return null;
}

function buildDefaultListComposition(options: StyleOptions): GeminiComposition {
  const movies = options.movies ?? [];
  const highlight = options.highlight ?? movies[0] ?? null;

  const heroCopy =
    "Fallback style: archival midnight waltz. Supply your own prompt to let Gemini rewrite this entire layout.";

  const cards = movies
    .map(
      (movie) => `
      <article class="nf-card" data-movie-card>
        <div class="nf-card__meta">
          <p class="nf-card__year">${escapeHtml(String(movie.releaseYear))} | Registry ${movie.registryYear}</p>
          <p class="nf-card__runtime">${movie.runtimeMinutes} min | ${escapeHtml(movie.genres.join(", "))}</p>
        </div>
        <h3 class="nf-card__title">${escapeHtml(movie.title)}</h3>
        <p class="nf-card__summary">${escapeHtml(movie.summary)}</p>
        <a class="nf-card__link" href="/movies/${movie.slug}">View dossier</a>
      </article>`
    )
    .join("\n");

  const html = normalizeHtmlFragment(`
  <section class="nf-hero">
    <p class="nf-hero__eyebrow">United States National Film Registry</p>
    <h1 class="nf-hero__title">Manual fallback layout</h1>
    <p class="nf-hero__body">${escapeHtml(heroCopy)}</p>
    <p class="nf-hero__body">Current catalog size: ${movies.length} films</p>
  </section>

  <section class="nf-random-shell">
    <div class="nf-random-panel" data-random-panel>
      <p class="nf-random-eyebrow">Tonight's pick</p>
      <h2 class="nf-random-title" data-random-title>${highlight ? escapeHtml(highlight.title) : "Select a film"}</h2>
      <p class="nf-random-meta" data-random-meta>${highlight
      ? `${highlight.releaseYear} | Registry ${highlight.registryYear} | ${highlight.runtimeMinutes} min`
      : "Click the spin button to generate a title"
    }</p>
      <p class="nf-random-logline" data-random-logline>${highlight ? escapeHtml(highlight.logline) : "We will display a logline once a film is selected."
    }</p>
      <a class="nf-random-link" data-random-link href="${highlight ? `/movies/${highlight.slug}` : "#"}">
        Explore dossier
      </a>
    </div>
    <button class="nf-random-button" data-random-button type="button">
      Spin another registry gem
    </button>
  </section>

  <section class="nf-grid" data-movie-grid>
    ${cards || "<p>No films were found in the registry dataset.</p>"}
  </section>
  `.trim());

  const css = `
  :root {
    color-scheme: dark;
    font-family: "Geist Sans", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #030712;
    color: #f8fafc;
  }

  body {
    margin: 0;
    background: radial-gradient(circle at top, #0b1224, #020308 65%);
    min-height: 100vh;
    padding: 2.5rem clamp(1rem, 4vw, 4rem);
  }

  .nf-hero {
    max-width: 60rem;
    margin: 0 auto 3rem;
    text-align: center;
  }

  .nf-hero__eyebrow {
    letter-spacing: 0.4em;
    text-transform: uppercase;
    font-size: 0.75rem;
    color: #fbbf24;
  }

  .nf-hero__title {
    font-size: clamp(2.5rem, 5vw, 4.5rem);
    margin: 1rem 0;
  }

  .nf-random-shell {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
    align-items: stretch;
  }

  .nf-random-panel {
    border: 1px solid rgba(248, 250, 252, 0.15);
    border-radius: 1.5rem;
    padding: 2rem;
    background: linear-gradient(135deg, rgba(10, 15, 28, 0.7), rgba(255, 215, 0, 0.08));
  }

  .nf-random-button {
    border-radius: 999px;
    border: none;
    padding: 1rem 1.5rem;
    background: #fbbf24;
    color: #111;
    font-weight: 600;
    cursor: pointer;
  }

  .nf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.25rem;
  }

  .nf-card {
    border: 1px solid rgba(248, 250, 252, 0.15);
    border-radius: 1.25rem;
    padding: 1.5rem;
    background: rgba(8, 15, 32, 0.85);
  }

  .nf-card__title {
    margin-top: 0.75rem;
    font-size: 1.35rem;
  }

  .nf-card__link {
    display: inline-flex;
    margin-top: 1rem;
    text-decoration: none;
    color: #fbbf24;
    font-weight: 600;
  }
  `;

  return {
    html,
    css,
    notes: [
      "Fallback theme: midnight archive with aurora gradients.",
      "Random panel + button are wired via data attributes.",
    ],
  };
}

function buildDefaultDetailComposition(options: StyleOptions): GeminiComposition {
  const movie = options.movie;
  if (!movie) {
    return {
      html: `<section class="nf-detail-empty"><h1>Film not found</h1><p>The requested registry entry was unavailable.</p></section>`,
      css: `
      body { background: #020617; color: #f8fafc; font-family: "Geist Sans", system-ui, sans-serif; padding: 3rem; }
      .nf-detail-empty { max-width: 40rem; margin: 0 auto; text-align: center; }
      `,
      notes: ["Fallback detail view when no film metadata is present."],
    };
  }

  const html = normalizeHtmlFragment(`
  <article class="nf-detail-shell">
    <header class="nf-detail-hero">
      <p class="nf-detail-eyebrow">Registry dossier | ${movie.registryYear}</p>
      <h1>${escapeHtml(movie.title)}</h1>
      <p class="nf-detail-meta">${movie.releaseYear} | ${movie.runtimeMinutes} min | Directed by ${escapeHtml(
    movie.directors.join(", ")
  )}</p>
    </header>
    <section class="nf-detail-body">
      <p class="nf-detail-logline">${escapeHtml(movie.logline)}</p>
      <p class="nf-detail-summary">${escapeHtml(movie.summary)}</p>
      ${movie.whyImportant
      ? `<div class="nf-detail-why">
        <h2>Why the Library of Congress preserved it</h2>
        <p>${escapeHtml(movie.whyImportant)}</p>
      </div>`
      : ""
    }
      ${movie.cast.length > 0
      ? `<p class="nf-detail-cast"><strong>Cast:</strong> ${escapeHtml(movie.cast.join(", "))}</p>`
      : ""
    }
    </section>
    <footer class="nf-detail-footer">
      <a class="nf-detail-link" href="${escapeHtml(
      movie.watchUrl
    )}" target="_blank" rel="noreferrer">Visit the Library of Congress record</a>
      <a class="nf-detail-link nf-detail-link--ghost" href="/">Back to registry list</a>
    </footer>
  </article>
  `.trim());

  const css = `
  :root {
    color-scheme: dark;
  }

  body {
    margin: 0;
    min-height: 100vh;
    background: radial-gradient(circle at top, #0f172a, #020617 70%);
    color: #e2e8f0;
    font-family: "Geist Sans", "Inter", system-ui, sans-serif;
    padding: 3rem clamp(1rem, 6vw, 5rem);
  }

  .nf-detail-shell {
    max-width: 60rem;
    margin: 0 auto;
    border: 1px solid rgba(226, 232, 240, 0.2);
    border-radius: 2rem;
    padding: clamp(1.5rem, 4vw, 3rem);
    background: rgba(2, 6, 23, 0.75);
    backdrop-filter: blur(12px);
  }

  .nf-detail-eyebrow {
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: #facc15;
    font-size: 0.75rem;
  }

  .nf-detail-meta {
    color: rgba(226, 232, 240, 0.75);
    margin-top: 0.75rem;
  }

  .nf-detail-why {
    margin: 2rem 0;
    padding: 1.5rem;
    border-radius: 1.25rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(250, 204, 21, 0.35);
  }

  .nf-detail-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 2rem;
  }

  .nf-detail-link {
    text-decoration: none;
    border-radius: 999px;
    padding: 0.85rem 1.75rem;
    background: #facc15;
    color: #111;
    font-weight: 600;
  }

  .nf-detail-link--ghost {
    background: transparent;
    color: #facc15;
    border: 1px solid rgba(250, 204, 21, 0.4);
  }
  `;

  return {
    html,
    css,
    notes: [
      "Fallback detail shell uses aurora gradients and glassmorphism.",
      "Primary CTA always links to the Library of Congress resource.",
    ],
  };
}

export function buildDefaultComposition(options: StyleOptions): GeminiComposition {
  return options.scope === "detail"
    ? buildDefaultDetailComposition(options)
    : buildDefaultListComposition(options);
}

import { getLLMConfig } from "@/lib/styleState";

export async function generateGemini(options: StyleOptions): Promise<GeminiComposition | null> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: composePrompt(options) }],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("Gemini API returned non-OK status", await response.text());
      return null;
    }

    const data = await response.json();
    const parsed = parseGeminiResponse(data);
    return parsed;
  } catch (error) {
    console.error("Gemini API failed", error);
    return null;
  }
}
