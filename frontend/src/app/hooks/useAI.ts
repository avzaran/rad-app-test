import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/repositories";
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  AIStreamChunk,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
} from "../types/ai";

/** React Query mutation for synchronous AI generation. */
export function useAIGenerate() {
  return useMutation<AIGenerateResponse, Error, AIGenerateRequest>({
    mutationFn: (req) => api.generateAI(req),
  });
}

export function useKnowledgeSearch() {
  return useMutation<KnowledgeSearchResponse, Error, KnowledgeSearchRequest>({
    mutationFn: (req) => api.searchKnowledge(req),
  });
}

/** Custom hook for SSE streaming AI generation. */
export function useAIStream() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback((request: AIGenerateRequest) => {
    // Abort any previous stream
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setText("");
    setError(null);
    setTokensUsed(0);
    setIsStreaming(true);

    api
      .streamAI(
        request,
        (chunk: AIStreamChunk) => {
          if (chunk.error) {
            setError(chunk.error);
            setIsStreaming(false);
            return;
          }
          if (chunk.delta) {
            setText((prev) => prev + chunk.delta);
          }
          if (chunk.done) {
            setIsStreaming(false);
            if (chunk.tokensUsed) {
              setTokensUsed(chunk.tokensUsed);
            }
          }
        },
        controller.signal,
      )
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsStreaming(false);
      });
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setText("");
    setError(null);
    setTokensUsed(0);
    setIsStreaming(false);
  }, []);

  return { text, isStreaming, error, tokensUsed, start, stop, reset };
}
