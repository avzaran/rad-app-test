import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./repositories";

describe("api.streamAI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the autocomplete stream contract unchanged", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response('data: {"delta":" test","done":false}\n\ndata: {"delta":"","done":true}\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );

    const chunks: Array<{ delta: string; done: boolean }> = [];

    await api.streamAI(
      {
        section: "autocomplete",
        currentContent: "Предыдущий текст",
        prefixText: "Начало текущего предложения",
        suffixText: "Конец текущего предложения.",
        modality: "CT",
        templateContent: "Шаблон",
        protocolId: "protocol-contract",
      },
      (chunk) => {
        chunks.push({ delta: chunk.delta, done: chunk.done });
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/ai/generate/stream",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );

    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.body))).toMatchObject({
      section: "autocomplete",
      currentContent: "Предыдущий текст",
      prefixText: "Начало текущего предложения",
      suffixText: "Конец текущего предложения.",
      modality: "CT",
      templateContent: "Шаблон",
      protocolId: "protocol-contract",
    });
    expect(chunks).toEqual([
      { delta: " test", done: false },
      { delta: "", done: true },
    ]);
  });
});
