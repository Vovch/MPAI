type ScopeKey = string;

const DEFAULT_PROMPT =
  process.env.DEFAULT_STYLE_PROMPT ??
  "You are a film curator creating an inviting and cinematic tone for a National Film Registry experience.";

const LIST_STYLE_PRESETS = [
  "Retro-arcade style leaderboard with neon scanlines, joystick callouts, and CRT bloom celebrating the registry roster.",
  "Cyberpunk street kiosk rendered with rain-soaked holograms, magenta/teal light leaks, and glitchy ticker tapes for each film.",
  "VHS-era fanzine in dark mode using photocopied halftones, overprinted stickers, and scribbled margin notes about every title.",
  "Solarized desert noir zine that mixes sun-bleached typography, mirage gradients, and badge-like film summaries.",
  "Analog mission-control board full of tactile toggles, NASA serif captions, and reel-to-reel meters tracking the collection.",
  "Gallery wall placards curated like a traveling museum show with linen textures, serif captions, and spotlight shadows.",
  "Midnight radio playlist interface with phosphor-green terminals, waveform dividers, and DJ-style commentary blurbs.",
  // "Cyberpunk-stylized page: chromium colors, neon glows, glitch effects, and holographic overlays celebrating each film.",
] as const;

const DETAIL_SCOPE_PROMPT =
  process.env.DETAIL_STYLE_PROMPT ??
  "Generate a single-movie dossier using everything you already know about this film—production lore, cultural ripples, cast myths. Keep it cinematic yet readable, and weave in sly easter eggs (props, quotes, hidden UI flourishes) whenever they enrich the story.";

const promptState: Record<ScopeKey, string> = {
  default: DEFAULT_PROMPT,
  list: DEFAULT_PROMPT,
  detail: DETAIL_SCOPE_PROMPT,
};

let listPromptOverridden = false;

function pickRandomListPrompt(): string {
  return LIST_STYLE_PRESETS[
    Math.floor(Math.random() * LIST_STYLE_PRESETS.length)
  ];
}

function resolveListPrompt(): string {
  if (listPromptOverridden && promptState.list) {
    return promptState.list;
  }

  const selection = pickRandomListPrompt();
  promptState.list = selection;
  return selection;
}

export function getPrompt(scope?: ScopeKey, name?: string): string {
  if (scope === "list") {
    return resolveListPrompt();
  }

  if (scope === "detail") {
    return `${promptState.detail} The movie is ${name}`;
  }

  if (scope && promptState[scope]) {
    return promptState[scope];
  }

  return resolveListPrompt();
}

export function setPrompt(prompt: string, scope?: ScopeKey): void {
  if (!prompt.trim()) {
    return;
  }

  if (scope === "list") {
    listPromptOverridden = true;
    promptState.list = prompt;
    return;
  }

  if (scope) {
    promptState[scope] = prompt;
    return;
  }

  promptState.default = prompt;
  promptState.list = prompt;
  listPromptOverridden = true;
}

export type LLMProvider = "gemini" | "openai" | "openrouter";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  baseURL?: string;
}

// Initialize with default values (OpenRouter GLM-4, env var key)
// Note: In a real app, we might want to persist this or handle it differently.
// For this local dev tool, in-memory is fine, but we need to be careful about
// the API route vs getStaticProps context.
// Since getStaticProps runs at build time or ISR time, it might not share state
// with API routes in a serverless env. But for "npm run dev" or "start", it usually does.
// However, to be safe for a "demo", we can just use this.
let llmConfig: LLMConfig = {
  provider: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  model: "z-ai/glm-4.6",
  baseURL: "https://openrouter.ai/api/v1",
};

export function getLLMConfig(): LLMConfig {
  return { ...llmConfig };
}

export function setLLMConfig(config: Partial<LLMConfig>): void {
  llmConfig = { ...llmConfig, ...config };
}
