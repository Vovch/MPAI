export type StyleScope = "list" | "detail";

export interface NationalFilm {
  slug: string;
  title: string;
  releaseYear: number;
  registryYear: number;
  directors: string[];
  cast: string[];
  runtimeMinutes: number;
  genres: string[];
  logline: string;
  summary: string;
  whyImportant: string;
  watchUrl: string;
  image: string;
}

export interface GeminiComposition {
  html: string;
  css: string;
  notes: string[];
}
