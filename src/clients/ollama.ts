// src/lib/ollama.ts

import fetch from "node-fetch";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

// for embedText 
type OllamaEmbeddingResponse = {
  model: string;
  embedding: number[];   // 1536 floats
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
};


// for generateResponse 
type OllamaGenerateResponse = {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
};

/**
 * Generate embeddings for a given text using Ollama.
 */
export async function embedText(text: string, model = "nomic-embed-text"): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embed error: ${res.statusText}`);
  }

        const data = (await res.json()) as OllamaEmbeddingResponse;
        return data.embedding;
}

/**
 * Run a completion with Ollama (optional).
 */

export async function ollamaGenerateJSON(args: {
  prompt: string;
  model?: string;
  signal?: AbortSignal;
  options?: Record<string, unknown>; // e.g. { temperature: 0 }
}): Promise<string> {
  const { prompt, model = "mistral", signal, options } = args;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options,
    }),
  });

  if (!res.ok) {
    throw new Error(`ollama generate error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as OllamaGenerateResponse;
  return data.response;
}