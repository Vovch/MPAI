import type { GeminiComposition, NationalFilm } from "@/types/movies";
import { getLLMConfig } from "@/lib/styleState";
import { generateGemini, buildDefaultComposition, composePrompt } from "@/lib/providers/gemini";
import { generateOpenAI } from "@/lib/providers/openai";

export type GeminiScope = "list" | "detail";

export interface StyleOptions {
    scope: GeminiScope;
    prompt: string;
    movies?: NationalFilm[];
    highlight?: NationalFilm | null;
    movie?: NationalFilm | null;
}

export async function generateStylePayload(options: StyleOptions): Promise<GeminiComposition> {
    const config = getLLMConfig();
    const fallback = buildDefaultComposition(options);

    let result: GeminiComposition | null = null;

    if (config.provider === "openai" || config.provider === "openrouter") {
        const prompt = composePrompt(options);
        result = await generateOpenAI(prompt);
    } else {
        // Default to Gemini
        result = await generateGemini(options);
    }

    return result ?? fallback;
}
