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
  status: AutocompleteStatus;
  isLoading: boolean;
  totalTokensUsed: number;
  accept: () => string;
  dismiss: () => void;
};

export type AutocompleteStatus = "idle" | "debouncing" | "loading" | "ready" | "error";

const DEBOUNCE_MS = 700;
const MIN_CONTENT_LENGTH = 15;
const MAX_CONTEXT_CHARS = 2000;
const AUTOCOMPLETE_CACHE_TTL_MS = 60_000;
const ERROR_COOLDOWN_MS = 5_000;

type CacheEntry = {
  suggestion: string;
  expiresAt: number;
};

const autocompleteCache = new Map<string, CacheEntry>();

function buildContextText(content: string, cursorPosition: number): string {
  return content.slice(0, cursorPosition).slice(-MAX_CONTEXT_CHARS);
}

function buildCacheKey(
  protocolId: string,
  modality: string,
  templateContent: string,
  contextText: string,
): string {
  return [protocolId, modality, templateContent, contextText].join("\u0001");
}

function getCachedSuggestion(cacheKey: string): string | null {
  const entry = autocompleteCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    autocompleteCache.delete(cacheKey);
    return null;
  }

  return entry.suggestion;
}

function setCachedSuggestion(cacheKey: string, suggestion: string): void {
  autocompleteCache.set(cacheKey, {
    suggestion,
    expiresAt: Date.now() + AUTOCOMPLETE_CACHE_TTL_MS,
  });
}

function isAtLineEnd(content: string, cursorPosition: number): boolean {
  return cursorPosition === content.length || content[cursorPosition] === "\n";
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
}

export function useAutocomplete({
  content,
  cursorPosition,
  modality,
  templateContent,
  protocolId,
  enabled,
}: UseAutocompleteOptions): UseAutocompleteReturn {
  const [suggestion, setSuggestion] = useState("");
  const [status, setStatus] = useState<AutocompleteStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const dismissedContextRef = useRef<string | null>(null);
  const errorCooldownRef = useRef<Map<string, number>>(new Map());

  const textBeforeCursor = content.slice(0, cursorPosition);
  const contextText = buildContextText(content, cursorPosition);
  const contextKey = buildCacheKey(protocolId, modality, templateContent, contextText);

  const invalidatePendingRequest = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    requestSeqRef.current += 1;
  }, []);

  useEffect(() => {
    setSuggestion("");

    const cooldownUntil = errorCooldownRef.current.get(contextKey);
    if (cooldownUntil && cooldownUntil <= Date.now()) {
      errorCooldownRef.current.delete(contextKey);
    }

    if (!enabled || textBeforeCursor.length < MIN_CONTENT_LENGTH || !isAtLineEnd(content, cursorPosition)) {
      invalidatePendingRequest();
      setIsLoading(false);
      setStatus("idle");
      return;
    }

    if (dismissedContextRef.current === contextKey) {
      invalidatePendingRequest();
      setIsLoading(false);
      setStatus("idle");
      return;
    }

    const activeCooldown = errorCooldownRef.current.get(contextKey);
    if (activeCooldown && activeCooldown > Date.now()) {
      invalidatePendingRequest();
      setIsLoading(false);
      setStatus("error");
      return;
    }

    const cachedSuggestion = getCachedSuggestion(contextKey);
    if (cachedSuggestion) {
      invalidatePendingRequest();
      setSuggestion(cachedSuggestion);
      setIsLoading(false);
      setStatus("ready");
      return;
    }

    setStatus("debouncing");
    timerRef.current = setTimeout(() => {
      const requestId = ++requestSeqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      let accumulated = "";
      let finalized = false;

      setIsLoading(true);
      setStatus("loading");

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
            if (controller.signal.aborted || requestSeqRef.current !== requestId) {
              return;
            }

            if (chunk.error) {
              finalized = true;
              abortRef.current = null;
              errorCooldownRef.current.set(contextKey, Date.now() + ERROR_COOLDOWN_MS);
              setSuggestion("");
              setIsLoading(false);
              setStatus("error");
              return;
            }

            if (chunk.done) {
              finalized = true;
              abortRef.current = null;
              if (chunk.tokensUsed) {
                setTotalTokensUsed((current) => current + chunk.tokensUsed);
              }
              if (accumulated) {
                setCachedSuggestion(contextKey, accumulated);
                setSuggestion(accumulated);
                setStatus("ready");
              } else {
                setSuggestion("");
                setStatus("idle");
              }
              setIsLoading(false);
              return;
            }

            accumulated += chunk.delta;
            setSuggestion(accumulated);
            setStatus("ready");
          },
          controller.signal,
        )
        .catch((error) => {
          if (
            finalized ||
            controller.signal.aborted ||
            requestSeqRef.current !== requestId ||
            isAbortError(error)
          ) {
            return;
          }

          finalized = true;
          abortRef.current = null;
          errorCooldownRef.current.set(contextKey, Date.now() + ERROR_COOLDOWN_MS);
          setSuggestion("");
          setStatus("error");
          setIsLoading(false);
        })
        .finally(() => {
          if (
            finalized ||
            controller.signal.aborted ||
            requestSeqRef.current !== requestId
          ) {
            return;
          }

          abortRef.current = null;
          if (accumulated) {
            setCachedSuggestion(contextKey, accumulated);
            setSuggestion(accumulated);
            setStatus("ready");
          } else {
            setSuggestion("");
            setStatus("idle");
          }
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      invalidatePendingRequest();
    };
  }, [
    content,
    cursorPosition,
    contextKey,
    enabled,
    invalidatePendingRequest,
    modality,
    protocolId,
    templateContent,
    textBeforeCursor.length,
  ]);

  const accept = useCallback((): string => {
    if (!suggestion) return content;
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    const newContent = before + suggestion + after;
    setSuggestion("");
    setStatus("idle");
    invalidatePendingRequest();
    return newContent;
  }, [content, cursorPosition, invalidatePendingRequest, suggestion]);

  const dismiss = useCallback(() => {
    setSuggestion("");
    setIsLoading(false);
    setStatus("idle");
    dismissedContextRef.current = contextKey;
    invalidatePendingRequest();
  }, [contextKey, invalidatePendingRequest]);

  return { suggestion, status, isLoading, totalTokensUsed, accept, dismiss };
}
