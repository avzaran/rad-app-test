import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutocomplete } from "./useAutocomplete";

const streamAIMock = vi.hoisted(() => vi.fn());

vi.mock("../api/repositories", () => ({
  api: {
    streamAI: streamAIMock,
  },
}));

type HookProps = Parameters<typeof useAutocomplete>[0];

function makeProps(overrides: Partial<HookProps> = {}): HookProps {
  const content = overrides.content ?? "abcdefghijklmnop";
  return {
    content,
    cursorPosition: overrides.cursorPosition ?? content.length,
    modality: overrides.modality ?? "CT",
    studyProfile: overrides.studyProfile ?? "КТ органов грудной клетки",
    knowledgeTags: overrides.knowledgeTags ?? [],
    sourceTemplateIds: overrides.sourceTemplateIds ?? [],
    templateContent: overrides.templateContent ?? "template",
    protocolId: overrides.protocolId ?? "protocol-default",
    enabled: overrides.enabled ?? true,
  };
}

async function advanceDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700);
  });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useAutocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    streamAIMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not request suggestions below the minimum content threshold", async () => {
    const { result } = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "below-threshold",
          content: "short text",
        }),
      ),
    );

    await advanceDebounce();

    expect(streamAIMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.suggestion).toBe("");
  });

  it("requests suggestions between words and sends prefix/suffix context", async () => {
    let capturedRequest: Record<string, unknown> | undefined;

    streamAIMock.mockImplementation(async (req, onChunk) => {
      capturedRequest = req as Record<string, unknown>;
      onChunk({ delta: "mildly enlarged", done: false });
      onChunk({ delta: "", done: true, tokensUsed: 3 });
    });

    const content = "abcdefghijklmnop liver normal size.";
    const { result } = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "between-words",
          content,
          cursorPosition: content.indexOf("normal"),
        }),
      ),
    );

    await advanceDebounce();
    await flushMicrotasks();

    expect(streamAIMock).toHaveBeenCalledTimes(1);
    expect(capturedRequest).toMatchObject({
      section: "autocomplete",
      currentContent: "abcdefghijklmnop liver ",
      prefixText: "abcdefghijklmnop liver ",
      suffixText: "normal size.",
      studyProfile: "КТ органов грудной клетки",
      knowledgeTags: [],
      sourceTemplateIds: [],
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.suggestion).toBe("mildly enlarged");
    expect(result.current.overlapText).toBe("");
  });

  it("requests suggestions between existing sentences", async () => {
    let capturedRequest: Record<string, unknown> | undefined;

    streamAIMock.mockImplementation(async (req, onChunk) => {
      capturedRequest = req as Record<string, unknown>;
      onChunk({ delta: "Дополнение. ", done: false });
      onChunk({ delta: "", done: true });
    });

    const content = "abcdefghijklmnop First sentence. Second sentence.";
    const cursorPosition = content.indexOf("Second");

    renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "between-sentences",
          content,
          cursorPosition,
        }),
      ),
    );

    await advanceDebounce();
    await flushMicrotasks();

    expect(streamAIMock).toHaveBeenCalledTimes(1);
    expect(capturedRequest).toMatchObject({
      prefixText: "",
      suffixText: "Second sentence.",
    });
  });

  it("does not request suggestions when the cursor is inside a word", async () => {
    const content = "abcdefghijklmnop middleword test.";
    const cursorPosition = content.indexOf("middleword") + 3;
    const { result } = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "inside-word",
          content,
          cursorPosition,
        }),
      ),
    );

    await advanceDebounce();

    expect(streamAIMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("debounces requests and exposes the returned suggestion", async () => {
    streamAIMock.mockImplementation(async (_req, onChunk) => {
      onChunk({ delta: " world", done: false });
      onChunk({ delta: "", done: true, tokensUsed: 2 });
    });

    const { result } = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "debounce-ready",
        }),
      ),
    );

    expect(result.current.status).toBe("debouncing");

    await advanceDebounce();
    await flushMicrotasks();

    expect(streamAIMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("ready");
    expect(result.current.suggestion).toBe(" world");
    expect(result.current.overlapText).toBe("");
    expect(result.current.totalTokensUsed).toBe(2);
  });

  it("aborts the active stream when the input changes", async () => {
    const signals: AbortSignal[] = [];

    streamAIMock.mockImplementation(async (_req, _onChunk, signal) => {
      signals.push(signal as AbortSignal);
      return new Promise<void>(() => {});
    });

    const { rerender } = renderHook((props: HookProps) => useAutocomplete(props), {
      initialProps: makeProps({
        protocolId: "abort-change",
      }),
    });

    await advanceDebounce();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(false);

    rerender(
      makeProps({
        protocolId: "abort-change",
        content: "abcdefghijklmnopq",
        cursorPosition: 17,
      }),
    );

    expect(signals[0]?.aborted).toBe(true);

    await advanceDebounce();
    expect(signals).toHaveLength(2);
  });

  it("aborts the active stream on unmount", async () => {
    const signals: AbortSignal[] = [];

    streamAIMock.mockImplementation(async (_req, _onChunk, signal) => {
      signals.push(signal as AbortSignal);
      return new Promise<void>(() => {});
    });

    const { unmount } = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "abort-unmount",
        }),
      ),
    );

    await advanceDebounce();
    expect(signals).toHaveLength(1);

    unmount();

    expect(signals[0]?.aborted).toBe(true);
  });

  it("ignores stale chunks from an older request", async () => {
    const handlers: Array<(chunk: { delta: string; done: boolean; error?: string }) => void> = [];

    streamAIMock.mockImplementation(async (_req, onChunk) => {
      handlers.push(onChunk);
      return new Promise<void>(() => {});
    });

    const { result, rerender } = renderHook((props: HookProps) => useAutocomplete(props), {
      initialProps: makeProps({
        protocolId: "stale-request",
      }),
    });

    await advanceDebounce();
    rerender(
      makeProps({
        protocolId: "stale-request",
        content: "abcdefghijklmnopq",
        cursorPosition: 17,
      }),
    );
    await advanceDebounce();

    act(() => {
      handlers[0]?.({ delta: " stale", done: false });
      handlers[0]?.({ delta: "", done: true });
    });

    expect(result.current.suggestion).toBe("");

    act(() => {
      handlers[1]?.({ delta: " fresh", done: false });
    });

    expect(result.current.suggestion).toBe(" fresh");
    expect(result.current.overlapText).toBe("");
    expect(result.current.status).toBe("ready");
  });

  it("reuses the cached suggestion for the same context", async () => {
    streamAIMock.mockImplementation(async (_req, onChunk) => {
      onChunk({ delta: " cached", done: false });
      onChunk({ delta: "", done: true });
    });

    const initialProps = makeProps({
      protocolId: "cache-hit",
    });

    const first = renderHook((props: HookProps) => useAutocomplete(props), {
      initialProps,
    });

    await advanceDebounce();
    await flushMicrotasks();

    expect(first.result.current.suggestion).toBe(" cached");
    expect(first.result.current.overlapText).toBe("");
    first.unmount();
    streamAIMock.mockClear();

    const second = renderHook(() => useAutocomplete(initialProps));
    await flushMicrotasks();

    expect(second.result.current.status).toBe("ready");
    expect(second.result.current.suggestion).toBe(" cached");
    expect(second.result.current.overlapText).toBe("");
    expect(streamAIMock).not.toHaveBeenCalled();
  });

  it("keeps suffix-aware contexts separate in the cache key", async () => {
    streamAIMock.mockImplementation(async (_req, onChunk) => {
      onChunk({ delta: " cached", done: false });
      onChunk({ delta: "", done: true });
    });

    const sharedPrefix = "abcdefghijklmnop liver ";
    const first = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "cache-suffix-aware",
          content: `${sharedPrefix}normal size.`,
          cursorPosition: sharedPrefix.length,
        }),
      ),
    );

    await advanceDebounce();
    await flushMicrotasks();
    expect(first.result.current.suggestion).toBe(" cached");
    expect(first.result.current.overlapText).toBe("");
    first.unmount();

    const second = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "cache-suffix-aware",
          content: `${sharedPrefix}unchanged contour.`,
          cursorPosition: sharedPrefix.length,
        }),
      ),
    );

    await advanceDebounce();
    await flushMicrotasks();

    expect(streamAIMock).toHaveBeenCalledTimes(2);
    expect(second.result.current.suggestion).toBe(" cached");
    expect(second.result.current.overlapText).toBe("");
  });

  it("suppresses the same context after dismiss until the user changes the text", async () => {
    streamAIMock.mockImplementation(async (_req, onChunk) => {
      onChunk({ delta: " again", done: false });
      onChunk({ delta: "", done: true });
    });

    const initialProps = makeProps({
      protocolId: "dismiss-suppression",
    });

    const { result, rerender } = renderHook((props: HookProps) => useAutocomplete(props), {
      initialProps,
    });

    await advanceDebounce();
    await flushMicrotasks();

    expect(result.current.suggestion).toBe(" again");
    act(() => {
      result.current.dismiss();
    });

    rerender({
      ...initialProps,
      enabled: false,
    });
    rerender(initialProps);
    await advanceDebounce();

    expect(streamAIMock).toHaveBeenCalledTimes(1);

    rerender(
      makeProps({
        protocolId: "dismiss-suppression",
        content: "abcdefghijklmnop!",
        cursorPosition: 17,
      }),
    );
    await advanceDebounce();

    expect(streamAIMock).toHaveBeenCalledTimes(2);
  });

  it("enters error state and cools down repeated failures for the same context", async () => {
    streamAIMock.mockRejectedValue(new Error("AI stream unavailable"));

    const initialProps = makeProps({
      protocolId: "error-state",
    });

    const { result, rerender } = renderHook((props: HookProps) => useAutocomplete(props), {
      initialProps,
    });

    await advanceDebounce();
    await flushMicrotasks();

    expect(result.current.status).toBe("error");
    rerender({
      ...initialProps,
      enabled: false,
    });
    rerender(initialProps);
    await advanceDebounce();

    expect(streamAIMock).toHaveBeenCalledTimes(1);
  });

  it("accumulates token usage across completed autocomplete requests", async () => {
    streamAIMock
      .mockImplementationOnce(async (_req, onChunk) => {
        onChunk({ delta: " first", done: false });
        onChunk({ delta: "", done: true, tokensUsed: 3 });
      })
      .mockImplementationOnce(async (_req, onChunk) => {
        onChunk({ delta: " second", done: false });
        onChunk({ delta: "", done: true, tokensUsed: 5 });
      });

    const { result, rerender } = renderHook((props: HookProps) => useAutocomplete(props), {
      initialProps: makeProps({
        protocolId: "token-counter",
      }),
    });

    await advanceDebounce();
    await flushMicrotasks();

    expect(result.current.totalTokensUsed).toBe(3);

    rerender(
      makeProps({
        protocolId: "token-counter",
        content: "abcdefghijklmnop!",
        cursorPosition: 17,
      }),
    );

    await advanceDebounce();
    await flushMicrotasks();

    expect(result.current.totalTokensUsed).toBe(8);
  });

  it("trims overlap with the existing right-side text before showing and accepting a suggestion", async () => {
    streamAIMock.mockImplementation(async (_req, onChunk) => {
      onChunk({ delta: "mildly enlarged normal size.", done: false });
      onChunk({ delta: "", done: true, tokensUsed: 4 });
    });

    const content = "abcdefghijklmnop liver normal size.";
    const cursorPosition = content.indexOf("normal");
    const { result } = renderHook(() =>
      useAutocomplete(
        makeProps({
          protocolId: "suffix-trim",
          content,
          cursorPosition,
        }),
      ),
    );

    await advanceDebounce();
    await flushMicrotasks();

    expect(result.current.suggestion).toBe("mildly enlarged ");
    expect(result.current.overlapText).toBe("normal size.");

    let accepted = "";
    act(() => {
      accepted = result.current.accept();
    });

    expect(accepted).toBe("abcdefghijklmnop liver mildly enlarged normal size.");
  });
});
