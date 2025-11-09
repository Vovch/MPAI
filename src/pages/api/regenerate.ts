import type { NextApiRequest, NextApiResponse } from "next";

import { refreshMovieCache } from "@/lib/movies";
import { setPrompt } from "@/lib/styleState";

type ResponseBody =
  | {
      revalidated: true;
      path: string;
      scope: string;
    }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, slug } = req.body as { prompt?: string; slug?: string };
  const scope = slug ? slug : "list";

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "A prompt string is required." });
  }

  setPrompt(prompt, scope);
  await refreshMovieCache();

  const path = slug ? `/movies/${slug}` : "/";

  try {
    await res.revalidate(path);
    return res.status(200).json({ revalidated: true, path, scope });
  } catch (error) {
    console.error("Failed to revalidate", error);
    return res.status(500).json({ error: "Failed to revalidate the requested page." });
  }
}
