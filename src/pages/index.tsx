import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GetStaticProps } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { generateStylePayload } from "@/lib/gemini";
import { loadMovies } from "@/lib/movies";
import { getPrompt } from "@/lib/styleState";
import type { GeminiComposition, NationalFilm } from "@/types/movies";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface HomeProps {
  movies: NationalFilm[];
  composition: GeminiComposition;
  revalidatedAt: string;
  initialHighlight: NationalFilm | null;
}

export default function Home({ movies, composition, revalidatedAt, initialHighlight }: HomeProps) {
  const [highlight, setHighlight] = useState<NationalFilm | null>(() => initialHighlight ?? movies[0] ?? null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRandomButton, setHasRandomButton] = useState(true);
  const panelRef = useRef<HTMLElement | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const pickRandomMovie = useCallback((): NationalFilm | null => {
    if (!movies.length) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * movies.length);
    return movies[randomIndex] ?? null;
  }, [movies]);

  useEffect(() => {
    if (!movies.length) {
      setHasRandomButton(false);
      return;
    }

    panelRef.current = document.querySelector<HTMLElement>("[data-random-panel]");
    const button = document.querySelector<HTMLButtonElement>("[data-random-button]");

    if (!button) {
      setHasRandomButton(false);
      return;
    }

    setHasRandomButton(true);
    const handleClick = () => {
      const nextMovie = pickRandomMovie();
      if (nextMovie) {
        setHighlight(nextMovie);
      }
    };

    button.addEventListener("click", handleClick);
    return () => {
      button.removeEventListener("click", handleClick);
    };
  }, [composition.html, movies.length, pickRandomMovie]);

  useEffect(() => {
    if (!highlight) {
      return;
    }

    if (!panelRef.current) {
      panelRef.current = document.querySelector<HTMLElement>("[data-random-panel]");
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const titleNode = panel.querySelector<HTMLElement>("[data-random-title]");
    const metaNode = panel.querySelector<HTMLElement>("[data-random-meta]");
    const loglineNode = panel.querySelector<HTMLElement>("[data-random-logline]");
    const linkNode = panel.querySelector<HTMLAnchorElement>("[data-random-link]");

    if (titleNode) {
      titleNode.textContent = highlight.title;
    }
    if (metaNode) {
      metaNode.textContent = `${highlight.releaseYear} | Registry ${highlight.registryYear} | ${highlight.runtimeMinutes} min`;
    }
    if (loglineNode) {
      loglineNode.textContent = highlight.logline;
    }
    if (linkNode) {
      linkNode.href = `/movies/${highlight.slug}`;
      linkNode.textContent = "Explore dossier";
      linkNode.setAttribute("aria-label", `Read more about ${highlight.title}`);
    }
  }, [highlight]);

  const handlePromptSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customPrompt.trim()) {
      setStatusMessage("Describe a tone or style before regenerating.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: customPrompt }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatusMessage("Prompt sent! Give ISR a few seconds, then refresh to see the new layout.");
      setCustomPrompt("");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try a different prompt."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSpin = () => {
    const randomMovie = pickRandomMovie();
    if (randomMovie) {
      setHighlight(randomMovie);
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const filteredMovies = useMemo(() => {
    if (!normalizedQuery) {
      return movies;
    }

    return movies.filter((movie) => {
      const haystack = [
        movie.title,
        movie.directors.join(" "),
        movie.genres.join(" "),
        movie.releaseYear ? String(movie.releaseYear) : "",
        movie.registryYear ? String(movie.registryYear) : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [movies, normalizedQuery]);

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col`}>
      <style dangerouslySetInnerHTML={{ __html: composition.css }} />
      <div
        className="gemini-stage flex-1 px-4 py-6 sm:px-8"
        key={revalidatedAt}
        data-gemini-html
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: composition.html }}
      />

      <section className="manual-panel mx-auto my-8 flex w-full max-w-5xl flex-col gap-4 rounded-3xl border border-neutral-900/40 bg-black/80 px-6 py-8 text-white shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">Live controls</p>
          <h2 className="text-2xl font-semibold">Regenerate this page with your own prompt</h2>
          <p className="text-sm text-white/70">
            Gemini authored every bit of CSS and markup inside the experience above. Send a mood or design direction to
            re-run Gemini 2.0 Flash now, or simply wait for the five-minute ISR window for an automatic refresh.
          </p>
        </div>
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={handlePromptSubmit}>
          <label htmlFor="prompt" className="sr-only">
            Style prompt
          </label>
          <input
            id="prompt"
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder="e.g. Brutalist newsprint collage or Neon CRT scanlines"
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-white placeholder:text-white/50 focus:border-amber-300 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-black transition enabled:hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Sending..." : "Regenerate now"}
          </button>
        </form>
        {statusMessage && <p className="text-sm text-white/70">{statusMessage}</p>}
        <div className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
          <p>
            Last regenerated at:{" "}
            <span className="font-mono text-emerald-300">{new Date(revalidatedAt).toLocaleString('ru')}</span>
          </p>
          {!hasRandomButton && movies.length > 0 && (
            <button
              type="button"
              onClick={handleManualSpin}
              className="rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white hover:border-white"
            >
              Spin random film (fallback)
            </button>
          )}
        </div>
        {composition.notes.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">Gemini notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
              {composition.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {movies.length > 0 && (
        <section className="mx-auto mb-12 mt-4 w-full max-w-6xl rounded-3xl border border-white/5 bg-black/60 px-6 py-8 text-white shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">Complete registry index</p>
              <h2 className="text-2xl font-semibold">Browse all {movies.length} films</h2>
              <p className="text-sm text-white/70">
                Search titles, directors, or genres below. Results update instantly so the full catalog is always within reach.
              </p>
            </div>
            <div className="w-full max-w-md">
              <label htmlFor="movie-search" className="sr-only">
                Search registry films
              </label>
              <input
                id="movie-search"
                type="search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by title, director, year, or genre"
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-white/50 focus:border-amber-300 focus:outline-none"
              />
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white/40">
                {normalizedQuery
                  ? `Showing ${filteredMovies.length} match${filteredMovies.length === 1 ? "" : "es"}`
                  : `Showing all ${movies.length} films`}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {filteredMovies.length > 0 ? (
              filteredMovies.map((movie) => (
                <article
                  key={movie.slug}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-amber-200/40"
                >
                  <div className="text-xs uppercase tracking-[0.3em] text-white/40">
                    <span>{movie.releaseYear || "Year N/A"}</span>
                    <span className="px-2 text-white/20">|</span>
                    <span>Registry {movie.registryYear || "—"}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-white">{movie.title}</h3>
                  <p className="text-sm text-white/60">
                    {movie.directors.length > 0 ? movie.directors.join(", ") : "Director information unavailable"}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {movie.summary || movie.logline || "Visit the dossier for synopsis and preservation notes."}
                  </p>
                  <a
                    className="mt-4 text-sm font-semibold text-amber-300 hover:text-amber-100"
                    href={`/movies/${movie.slug}`}
                  >
                    Open dossier →
                  </a>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                No films match “{searchQuery}”. Try another title, director, or genre.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const movies = await loadMovies();
  const prompt = getPrompt("list");
  const initialHighlight =
    movies.length > 0 ? movies[Math.floor(Math.random() * movies.length)] : null;
  const composition = await generateStylePayload({
    scope: "list",
    prompt,
    movies,
    highlight: initialHighlight,
  });

  return {
    props: {
      movies,
      composition,
      initialHighlight,
      revalidatedAt: new Date().toISOString(),
    },
    revalidate: 300,
  };
};
