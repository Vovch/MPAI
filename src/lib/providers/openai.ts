import type { GeminiComposition } from "@/types/movies";
import { getLLMConfig } from "@/lib/styleState";

interface OpenAICompletionResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

function extractJsonFromText(text: string): string | null {
    if (!text) return null;
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch && fencedMatch[1]) return fencedMatch[1].trim();

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return text.slice(firstBrace, lastBrace + 1).trim();
    }
    return text.trim();
}

function normalizeHtmlFragment(html: string): string {
    if (!html) return "";
    return html
        .replace(/\bclassName=/g, "class=")
        .replace(/\bhtmlFor=/g, "for=")
        .replace(/\sdata-([\w]+)=/g, (match) => match.toLowerCase());
}

export async function generateOpenAI(prompt: string): Promise<GeminiComposition | null> {
    const config = getLLMConfig();
    if (!config.apiKey) {
        console.warn("OpenAI API key is missing");
        return null;
    }

    try {
        const baseURL = config.baseURL || "https://api.openai.com/v1";
        // Ensure no trailing slash
        const cleanBaseURL = baseURL.replace(/\/$/, "");

        const response = await fetch(`${cleanBaseURL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model || "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that generates JSON for a movie registry app.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            console.warn("OpenAI API returned non-OK status", await response.text());
            return null;
        }

        const data = (await response.json()) as OpenAICompletionResponse;
        const content = data.choices[0]?.message?.content;

        if (!content) return null;

        const sanitized = extractJsonFromText(content);
        if (!sanitized) return null;

        const parsed = JSON.parse(sanitized);
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
                html: normalizeHtmlFragment(html),
                css,
                notes: filteredNotes,
            };
        }
        return null;
    } catch (error) {
        console.error("OpenAI API failed", error);
        return null;
    }
}
