import type { NextApiRequest, NextApiResponse } from "next";
import { setLLMConfig, LLMConfig } from "@/lib/styleState";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: "Method not allowed" });
    }

    const config = req.body as Partial<LLMConfig>;

    // Basic validation
    if (config.provider && !["gemini", "openai", "openrouter"].includes(config.provider)) {
        return res.status(400).json({ error: "Invalid provider" });
    }

    setLLMConfig(config);

    return res.status(200).json({ success: true });
}
