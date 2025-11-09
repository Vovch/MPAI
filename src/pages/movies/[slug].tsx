import { FormEvent, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { GetStaticPaths, GetStaticProps } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { generateStylePayload } from "@/lib/gemini";
import { getMovieBySlug, loadMovies } from "@/lib/movies";
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

interface MoviePageProps {
  movie: NationalFilm;
  composition: GeminiComposition;
  revalidatedAt: string;
}

export default function MoviePage({ movie, composition, revalidatedAt }: MoviePageProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePromptSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customPrompt.trim()) {
      setStatusMessage("Share how Gemini should describe this film before regenerating.");
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
        body: JSON.stringify({ prompt: customPrompt, slug: movie.slug }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatusMessage("Prompt received. Refresh shortly to read Gemini's new treatment.");
      setCustomPrompt("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to regenerate. Try again soon.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col`}>
      <Head>
        <title>{`${movie.title} | US National Film Registry`}</title>
        <meta name="description" content={movie.logline} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: composition.css }} />
      <div
        className="gemini-stage flex-1 px-4 py-6 sm:px-8"
        key={revalidatedAt}
        data-gemini-html
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: composition.html }}
      />

      <section className="manual-panel mx-auto my-8 flex w-full max-w-4xl flex-col gap-4 rounded-3xl border border-neutral-900/40 bg-black/80 px-6 py-8 text-white shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">Live controls</p>
          <h2 className="text-2xl font-semibold">Tell Gemini how to restyle this dossier</h2>
          <p className="text-sm text-white/70">
            Each regeneration asks Gemini 2.0 Flash to rewrite the HTML and CSS for {movie.title}. Drop a vibe or
            editorial angle to immediately request a new ISR build for this page.
          </p>
        </div>
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={handlePromptSubmit}>
          <label htmlFor="detailPrompt" className="sr-only">
            Style prompt
          </label>
          <input
            id="detailPrompt"
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder="e.g. Smithsonian exhibition placard or VHS-era fanzine"
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-white placeholder:text-white/50 focus:border-amber-300 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-black transition enabled:hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Sending..." : "Regenerate dossier"}
          </button>
        </form>
        {statusMessage && <p className="text-sm text-white/70">{statusMessage}</p>}
        <div className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
          <p>
            Last regenerated at:{" "}
            <span className="font-mono text-emerald-300">{new Date(revalidatedAt).toLocaleString('ru')}</span>
          </p>
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.3em] text-white transition hover:text-amber-200"
          >
            Back to registry list
          </Link>
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
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const movies = await loadMovies();
  return {
    paths: movies.map((movie) => ({ params: { slug: movie.slug } })),
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<MoviePageProps> = async ({ params }) => {
  const slug = params?.slug;
  if (typeof slug !== "string") {
    return { notFound: true };
  }

  const movie = await getMovieBySlug(slug);
  if (!movie) {
    return { notFound: true };
  }

  const prompt = getPrompt(slug);
  const composition = await generateStylePayload({
    scope: "detail",
    prompt,
    movie,
  });

  return {
    props: {
      movie,
      composition,
      revalidatedAt: new Date().toISOString(),
    },
    revalidate: 300,
  };
};
