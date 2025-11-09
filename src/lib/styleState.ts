type ScopeKey = string;

const DEFAULT_PROMPT =
  process.env.DEFAULT_STYLE_PROMPT ??
  "You are a film curator creating an inviting and cinematic tone for a National Film Registry experience.";

const promptState: Record<ScopeKey, string> = {
  default: DEFAULT_PROMPT,
  list: DEFAULT_PROMPT,
};

export function getPrompt(scope?: ScopeKey): string {
  if (scope && promptState[scope]) {
    return promptState[scope];
  }

  return promptState.list ?? promptState.default;
}

export function setPrompt(prompt: string, scope?: ScopeKey): void {
  if (!prompt.trim()) {
    return;
  }

  if (scope) {
    promptState[scope] = prompt;
    return;
  }

  promptState.default = prompt;
  promptState.list = prompt;
}
