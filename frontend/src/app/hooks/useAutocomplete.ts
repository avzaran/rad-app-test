import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api/repositories";
import type { Modality } from "../types/models";

type UseAutocompleteOptions = {
  content: string;
  cursorPosition: number;
  modality: string;
  templateContent: string;
  protocolId: string;
  enabled: boolean;
};

type UseAutocompleteReturn = {
  suggestion: string;
  isLoading: boolean;
  accept: () => string;
  dismiss: () => void;
};

const DEBOUNCE_MS = 700;
const MIN_CONTENT_LENGTH = 15;
const MAX_CONTEXT_CHARS = 2000;

export function useAutocomplete({
  content,
  cursorPosition,
  modality,
  templateContent,
  protocolId,
  enabled,
}: UseAutocompleteOptions): UseAutocompleteReturn {
  const [suggestion, setSuggestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset suggestion and cancel in-flight request on content change
  useEffect(() => {
    setSuggestion("");

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const textBeforeCursor = content.slice(0, cursorPosition);

    // Don't trigger if disabled, content too short, or cursor not at end of a line
    const isAtLineEnd =
      cursorPosition === content.length ||
      content[cursorPosition] === "\n";

    if (!enabled || textBeforeCursor.length < MIN_CONTENT_LENGTH || !isAtLineEnd) {
      setIsLoading(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);

      const contextText = textBeforeCursor.slice(-MAX_CONTEXT_CHARS);

      let accumulated = "";
      api
        .streamAI(
          {
            section: "autocomplete",
            currentContent: contextText,
            modality: modality as Modality,
            templateContent,
            protocolId,
          },
          (chunk) => {
            if (controller.signal.aborted) return;
            if (chunk.error) {
              setIsLoading(false);
              return;
            }
            if (chunk.done) {
              setIsLoading(false);
              return;
            }
            accumulated += chunk.delta;
            setSuggestion(accumulated);
          },
          controller.signal,
        )
        .catch(() => {
          // aborted or network error — ignore
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, cursorPosition, modality, templateContent, protocolId, enabled]);

  const accept = useCallback((): string => {
    if (!suggestion) return content;
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    const newContent = before + suggestion + after;
    setSuggestion("");
    return newContent;
  }, [suggestion, content, cursorPosition]);

  const dismiss = useCallback(() => {
    setSuggestion("");
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return { suggestion, isLoading, accept, dismiss };
}
