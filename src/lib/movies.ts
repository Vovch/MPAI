import path from "path";
import { promises as fs } from "fs";

import type { NationalFilm } from "@/types/movies";

let movieCache: NationalFilm[] | null = null;

const MOVIES_PATH = path.join(process.cwd(), "movies.json");

async function readMoviesFile(): Promise<NationalFilm[]> {
  const raw = await fs.readFile(MOVIES_PATH, "utf-8");
  return JSON.parse(raw) as NationalFilm[];
}

export async function loadMovies(): Promise<NationalFilm[]> {
  if (movieCache) {
    return movieCache;
  }

  movieCache = await readMoviesFile();
  return movieCache;
}

export async function refreshMovieCache(): Promise<void> {
  movieCache = await readMoviesFile();
}

export async function getMovieBySlug(slug: string): Promise<NationalFilm | null> {
  const movies = await loadMovies();
  return movies.find((movie) => movie.slug === slug) ?? null;
}

export async function getRandomMovie(): Promise<NationalFilm | null> {
  const movies = await loadMovies();
  if (!movies.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * movies.length);
  return movies[randomIndex];
}
