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

function ensureRandomButtonAttribute(html: string): string {
    // Check if there's already a data-random-button attribute
    if (html.includes('data-random-button')) {
        return html;
    }

    // Fix all types of malformed HTML in one comprehensive pass
    // 1. Fix self-closing spans: <span ... /> -> <span ...></span>
    html = html.replace(/<span([^>]*?)\s*\/>/gi, '<span$1></span>');

    // 2. Fix spans with /> in content: <span>Content /> -> <span>Content</span>
    html = html.replace(/<span([^>]*?)>(.*?)\s*\/>/gi, '<span$1>$2</span>');

    // 3. Fix self-closing button tags: <button ... /> -> <button ...></button>
    html = html.replace(/<button([^>]*?)\s*\/>/gi, '<button$1></button>');

    // 4. Fix buttons with /> in content: <button>Content /> -> <button>Content</button>
    html = html.replace(/<button([^>]*?)>(.*?)\s*\/>/gi, '<button$1>$2</button>');

    // Now add the data-random-button attribute to buttons with relevant keywords
    // Use a more permissive regex that works even with nested tags
    html = html.replace(
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

    return html;
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
                html: ensureRandomButtonAttribute(normalizeHtmlFragment(html)),
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
