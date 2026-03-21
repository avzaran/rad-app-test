import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api/repositories";
import type { Modality } from "../types/models";

type UseAutocompleteOptions = {
  content: string;
  cursorPosition: number;
  modality: string;
  studyProfile: string;
  knowledgeTags: string[];
  sourceTemplateIds: string[];
  templateContent: string;
  protocolId: string;
  enabled: boolean;
};

type UseAutocompleteReturn = {
  suggestion: string;
  overlapText: string;
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
  overlapText: string;
  expiresAt: number;
};

const autocompleteCache = new Map<string, CacheEntry>();

type CursorContext = {
  contextText: string;
  prefixText: string;
  suffixText: string;
};

function buildCacheKey(
  protocolId: string,
  modality: string,
  studyProfile: string,
  knowledgeTags: string[],
  sourceTemplateIds: string[],
  templateContent: string,
  contextText: string,
  prefixText: string,
  suffixText: string,
): string {
  return [
    protocolId,
    modality,
    studyProfile,
    knowledgeTags.join(","),
    sourceTemplateIds.join(","),
    templateContent,
    contextText,
    prefixText,
    suffixText,
  ].join("\u0001");
}

type SuggestionPreview = {
  suggestion: string;
  overlapText: string;
};

function getCachedSuggestion(cacheKey: string): SuggestionPreview | null {
  const entry = autocompleteCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    autocompleteCache.delete(cacheKey);
    return null;
  }

  return {
    suggestion: entry.suggestion,
    overlapText: entry.overlapText,
  };
}

function setCachedSuggestion(cacheKey: string, suggestion: string, overlapText: string): void {
  autocompleteCache.set(cacheKey, {
    suggestion,
    overlapText,
    expiresAt: Date.now() + AUTOCOMPLETE_CACHE_TTL_MS,
  });
}

function buildContextText(content: string, cursorPosition: number): string {
  return content.slice(0, cursorPosition).slice(-MAX_CONTEXT_CHARS);
}

function isWordCharacter(char: string | undefined): boolean {
  return Boolean(char) && (/[\p{L}\p{N}]/u.test(char) || char === "_" || char === "-" || char === "/");
}

function isCursorInsideWord(content: string, cursorPosition: number): boolean {
  return isWordCharacter(content[cursorPosition - 1]) && isWordCharacter(content[cursorPosition]);
}

function isSentenceBoundary(char: string | undefined): boolean {
  return char === "." || char === "!" || char === "?" || char === "\n";
}

function skipLeadingWhitespace(content: string, start: number, cursorPosition: number): number {
  let nextStart = start;

  while (nextStart < cursorPosition && /\s/u.test(content[nextStart] ?? "")) {
    nextStart += 1;
  }

  return nextStart;
}

function findSentenceStart(content: string, cursorPosition: number): number {
  for (let index = cursorPosition - 1; index >= 0; index -= 1) {
    if (isSentenceBoundary(content[index])) {
      return skipLeadingWhitespace(content, index + 1, cursorPosition);
    }
  }

  return skipLeadingWhitespace(content, 0, cursorPosition);
}

function findSentenceEnd(content: string, cursorPosition: number): number {
  for (let index = cursorPosition; index < content.length; index += 1) {
    if (!isSentenceBoundary(content[index])) {
      continue;
    }

    return content[index] === "\n" ? index : index + 1;
  }

  return content.length;
}

function extractCursorContext(content: string, cursorPosition: number): CursorContext {
  const sentenceStart = findSentenceStart(content, cursorPosition);
  const sentenceEnd = findSentenceEnd(content, cursorPosition);

  return {
    contextText: buildContextText(content, cursorPosition),
    prefixText: content.slice(sentenceStart, cursorPosition),
    suffixText: content.slice(cursorPosition, sentenceEnd),
  };
}

function resolveSuggestionPreview(suggestion: string, suffixText: string): SuggestionPreview {
  if (!suggestion || !suffixText) {
    return {
      suggestion,
      overlapText: "",
    };
  }

  const maxOverlap = Math.min(suggestion.length, suffixText.length);

  for (let overlapSize = maxOverlap; overlapSize > 0; overlapSize -= 1) {
    if (suggestion.slice(-overlapSize) === suffixText.slice(0, overlapSize)) {
      return {
        suggestion: suggestion.slice(0, -overlapSize),
        overlapText: suffixText.slice(0, overlapSize),
      };
    }
  }

  return {
    suggestion,
    overlapText: "",
  };
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
}

export function useAutocomplete({
  content,
  cursorPosition,
  modality,
  studyProfile,
  knowledgeTags,
  sourceTemplateIds,
  templateContent,
  protocolId,
  enabled,
}: UseAutocompleteOptions): UseAutocompleteReturn {
  const [suggestion, setSuggestion] = useState("");
  const [overlapText, setOverlapText] = useState("");
  const [status, setStatus] = useState<AutocompleteStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const dismissedContextRef = useRef<string | null>(null);
  const errorCooldownRef = useRef<Map<string, number>>(new Map());

  const textBeforeCursor = content.slice(0, cursorPosition);
  const { contextText, prefixText, suffixText } = extractCursorContext(content, cursorPosition);
  const contextKey = buildCacheKey(
    protocolId,
    modality,
    studyProfile,
    knowledgeTags,
    sourceTemplateIds,
    templateContent,
    contextText,
    prefixText,
    suffixText,
  );

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
    setOverlapText("");

    const cooldownUntil = errorCooldownRef.current.get(contextKey);
    if (cooldownUntil && cooldownUntil <= Date.now()) {
      errorCooldownRef.current.delete(contextKey);
    }

    if (!enabled || textBeforeCursor.length < MIN_CONTENT_LENGTH || isCursorInsideWord(content, cursorPosition)) {
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
      setSuggestion(cachedSuggestion.suggestion);
      setOverlapText(cachedSuggestion.overlapText);
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
            prefixText,
            suffixText,
            modality: modality as Modality,
            templateContent,
            protocolId,
            studyProfile,
            knowledgeTags,
            sourceTemplateIds,
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
              setOverlapText("");
              setIsLoading(false);
              setStatus("error");
              return;
            }

            if (chunk.done) {
              const preview = resolveSuggestionPreview(accumulated, suffixText);

              finalized = true;
              abortRef.current = null;
              if (chunk.tokensUsed) {
                setTotalTokensUsed((current) => current + chunk.tokensUsed);
              }
              if (preview.suggestion) {
                setCachedSuggestion(contextKey, preview.suggestion, preview.overlapText);
                setSuggestion(preview.suggestion);
                setOverlapText(preview.overlapText);
                setStatus("ready");
              } else {
                setSuggestion("");
                setOverlapText(preview.overlapText);
                setStatus("idle");
              }
              setIsLoading(false);
              return;
            }

            accumulated += chunk.delta;
            const preview = resolveSuggestionPreview(accumulated, suffixText);
            setSuggestion(preview.suggestion);
            setOverlapText(preview.overlapText);
            setStatus(preview.suggestion ? "ready" : "loading");
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
          setOverlapText("");
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
          const preview = resolveSuggestionPreview(accumulated, suffixText);
          if (preview.suggestion) {
            setCachedSuggestion(contextKey, preview.suggestion, preview.overlapText);
            setSuggestion(preview.suggestion);
            setOverlapText(preview.overlapText);
            setStatus("ready");
          } else {
            setSuggestion("");
            setOverlapText(preview.overlapText);
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
    sourceTemplateIds,
    studyProfile,
    templateContent,
    textBeforeCursor.length,
    knowledgeTags,
  ]);

  const accept = useCallback((): string => {
    if (!suggestion) return content;
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    const newContent = before + suggestion + after;
    setSuggestion("");
    setOverlapText("");
    setStatus("idle");
    invalidatePendingRequest();
    return newContent;
  }, [content, cursorPosition, invalidatePendingRequest, suggestion]);

  const dismiss = useCallback(() => {
    setSuggestion("");
    setOverlapText("");
    setIsLoading(false);
    setStatus("idle");
    dismissedContextRef.current = contextKey;
    invalidatePendingRequest();
  }, [contextKey, invalidatePendingRequest]);

  return { suggestion, overlapText, status, isLoading, totalTokensUsed, accept, dismiss };
}
