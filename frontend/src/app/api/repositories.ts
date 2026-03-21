import type { LoginRequest, LoginResponse, RefreshResponse, AuthUser } from "../types/auth";
import type { Patient, Protocol, Template, UploadedTemplate } from "../types/models";
import type { AIGenerateRequest, AIGenerateResponse, AIStreamChunk } from "../types/ai";
import { env } from "../lib/env";
import { http, getAccessToken } from "./http";
import {
  loginResponseSchema,
  patientSchema,
  patientsSchema,
  protocolSchema,
  protocolsSchema,
  refreshResponseSchema,
  templateSchema,
  templatesSchema,
  uploadedTemplateSchema,
  uploadedTemplatesSchema,
  authUserSchema,
} from "./schemas";
import { mockDb } from "./mockDb";

const STREAM_429_RETRIES = 3;
const STREAM_RETRY_BASE_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function buildStreamHeaders(token: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchAutocompleteStreamResponse(
  req: AIGenerateRequest,
  signal?: AbortSignal,
  retryCount = 0,
  refreshed = false,
): Promise<Response> {
  const token = getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/ai/generate/stream`, {
      method: "POST",
      headers: buildStreamHeaders(token),
      body: JSON.stringify(req),
      signal,
      credentials: "include",
    });
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw error;
    }

    throw new Error("AI stream network error");
  }

  if (response.status === 429 && retryCount < STREAM_429_RETRIES && !signal?.aborted) {
    await sleep(STREAM_RETRY_BASE_MS * Math.pow(2, retryCount));
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return fetchAutocompleteStreamResponse(req, signal, retryCount + 1, refreshed);
  }

  if (response.status === 401 && !refreshed && !signal?.aborted) {
    try {
      const refresh = await api.refresh();
      if (refresh.accessToken) {
        return fetchAutocompleteStreamResponse(req, signal, retryCount, true);
      }
    } catch {
      // Fall through to normalized unauthorized error below.
    }
  }

  if (!response.ok) {
    const errorBody = await readResponseText(response);

    if (response.status === 401) {
      throw new Error(errorBody ? `AI stream unauthorized: ${errorBody}` : "AI stream unauthorized");
    }

    if (response.status === 429) {
      throw new Error(errorBody ? `AI stream rate limited: ${errorBody}` : "AI stream rate limited");
    }

    throw new Error(
      errorBody ? `AI stream failed: ${response.status} ${errorBody}` : `AI stream failed: ${response.status}`,
    );
  }

  return response;
}

async function consumeAutocompleteStream(
  response: Response,
  onChunk: (chunk: AIStreamChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const remaining = buffer + decoder.decode();
        if (remaining.startsWith("data: ")) {
          try {
            const chunk = JSON.parse(remaining.slice(6)) as AIStreamChunk;
            onChunk(chunk);
          } catch {
            // skip malformed chunk
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          continue;
        }

        try {
          const chunk = JSON.parse(line.slice(6)) as AIStreamChunk;
          onChunk(chunk);
          if (chunk.done) {
            return;
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      return;
    }

    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore release failures
    }
  }
}

export const api = {
  listPatients: async (): Promise<Patient[]> => {
    if (env.useMockApi) {
      return mockDb.listPatients();
    }

    const response = await http.get("/patients");
    return patientsSchema.parse(response.data);
  },
  createPatient: async (payload: Omit<Patient, "id">): Promise<Patient> => {
    if (env.useMockApi) {
      return mockDb.createPatient(payload);
    }

    const response = await http.post("/patients", payload);
    return patientSchema.parse(response.data);
  },
  updatePatient: async (id: string, payload: Partial<Patient>): Promise<Patient> => {
    if (env.useMockApi) {
      return patientSchema.parse({ id, ...payload });
    }

    const response = await http.patch(`/patients/${id}`, payload);
    return patientSchema.parse(response.data);
  },
  deletePatient: async (id: string): Promise<void> => {
    if (env.useMockApi) {
      return;
    }

    await http.delete(`/patients/${id}`);
  },
  listTemplates: async (): Promise<Template[]> => {
    if (env.useMockApi) {
      return mockDb.listTemplates();
    }

    const response = await http.get("/templates");
    return templatesSchema.parse(response.data);
  },
  createTemplate: async (
    payload: Omit<Template, "id" | "createdAt">
  ): Promise<Template> => {
    if (env.useMockApi) {
      return mockDb.createTemplate(payload);
    }

    const response = await http.post("/templates", payload);
    return templateSchema.parse(response.data);
  },
  updateTemplate: async (id: string, payload: Partial<Template>): Promise<Template> => {
    if (env.useMockApi) {
      return templateSchema.parse({
        id,
        name: payload.name ?? "",
        modality: payload.modality ?? "CT",
        content: payload.content ?? "",
        createdAt: payload.createdAt ?? new Date().toISOString(),
      });
    }

    const response = await http.patch(`/templates/${id}`, payload);
    return templateSchema.parse(response.data);
  },
  deleteTemplate: async (id: string): Promise<void> => {
    if (env.useMockApi) {
      return mockDb.deleteTemplate(id);
    }

    await http.delete(`/templates/${id}`);
  },
  listProtocols: async (): Promise<Protocol[]> => {
    if (env.useMockApi) {
      return mockDb.listProtocols();
    }

    const response = await http.get("/protocols");
    return protocolsSchema.parse(response.data) as Protocol[];
  },
  getProtocol: async (id: string): Promise<Protocol | null> => {
    if (env.useMockApi) {
      return mockDb.getProtocol(id);
    }

    const response = await http.get(`/protocols/${id}`);
    return protocolSchema.parse(response.data) as Protocol;
  },
  createProtocol: async (
    payload: Omit<Protocol, "id" | "createdAt" | "updatedAt" | "status">
  ): Promise<Protocol> => {
    if (env.useMockApi) {
      return mockDb.createProtocol(payload);
    }

    const response = await http.post("/protocols", payload);
    return protocolSchema.parse(response.data) as Protocol;
  },
  updateProtocol: async (id: string, payload: Partial<Protocol>): Promise<Protocol> => {
    if (env.useMockApi) {
      return mockDb.updateProtocol(id, payload);
    }

    const response = await http.patch(`/protocols/${id}`, payload);
    return protocolSchema.parse(response.data) as Protocol;
  },
  deleteProtocol: async (id: string): Promise<void> => {
    if (env.useMockApi) {
      return;
    }

    await http.delete(`/protocols/${id}`);
  },
  login: async (payload: LoginRequest): Promise<LoginResponse> => {
    if (env.useMockApi) {
      return mockDb.login(payload);
    }

    const response = await http.post("/auth/login", payload);
    return loginResponseSchema.parse(response.data);
  },
  refresh: async (): Promise<RefreshResponse> => {
    if (env.useMockApi) {
      return mockDb.refresh();
    }

    const response = await http.post("/auth/refresh");
    return refreshResponseSchema.parse(response.data);
  },
  me: async (): Promise<AuthUser> => {
    if (env.useMockApi) {
      return mockDb.me();
    }

    const response = await http.get("/me");
    return authUserSchema.parse(response.data);
  },
  verify2Fa: async (code: string): Promise<{ ok: boolean }> => {
    if (env.useMockApi) {
      return { ok: code.trim().length > 0 };
    }

    const response = await http.post("/auth/2fa/verify", { code });
    return response.data as { ok: boolean };
  },
  logout: async (): Promise<void> => {
    if (env.useMockApi) {
      return mockDb.logout();
    }

    await http.post("/auth/logout");
  },

  // -- Uploaded Templates --

  uploadTemplate: async (file: File, modality: string): Promise<UploadedTemplate> => {
    if (env.useMockApi) {
      return mockDb.uploadTemplate(file, modality as import("../types/models").Modality);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("modality", modality);

    const response = await http.post("/templates/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return uploadedTemplateSchema.parse(response.data);
  },

  uploadTemplatesBatch: async (files: File[], modality: string): Promise<UploadedTemplate[]> => {
    if (env.useMockApi) {
      return mockDb.uploadTemplatesBatch(files, modality as import("../types/models").Modality);
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    formData.append("modality", modality);

    const response = await http.post("/templates/upload/batch", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return uploadedTemplatesSchema.parse(response.data);
  },

  listUploadedTemplates: async (): Promise<UploadedTemplate[]> => {
    if (env.useMockApi) {
      return mockDb.listUploadedTemplates();
    }

    const response = await http.get("/templates/uploaded");
    return uploadedTemplatesSchema.parse(response.data);
  },

  deleteUploadedTemplate: async (id: string): Promise<void> => {
    if (env.useMockApi) {
      return mockDb.deleteUploadedTemplate(id);
    }

    await http.delete(`/templates/uploaded/${id}`);
  },

  getUploadedTemplate: async (id: string): Promise<UploadedTemplate> => {
    if (env.useMockApi) {
      return mockDb.getUploadedTemplate(id);
    }

    const response = await http.get(`/templates/uploaded/${id}`);
    return uploadedTemplateSchema.parse(response.data);
  },

  getUploadedTemplatesByModality: async (modality: string): Promise<UploadedTemplate[]> => {
    if (env.useMockApi) {
      return mockDb.getUploadedTemplatesByModality(modality);
    }

    const response = await http.get(`/templates/uploaded/modality/${modality}`);
    return uploadedTemplatesSchema.parse(response.data);
  },

  // -- AI --

  generateAI: async (req: AIGenerateRequest): Promise<AIGenerateResponse> => {
    if (env.useMockApi) {
      await new Promise((r) => setTimeout(r, 500));
      return {
        text: `[MOCK] Сгенерированный текст для ${req.section} (${req.modality})`,
        tokensUsed: 42,
      };
    }

    const response = await http.post("/ai/generate", req);
    return response.data as AIGenerateResponse;
  },

  streamAI: async (
    req: AIGenerateRequest,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    // Autocomplete always uses real AI, even in mock mode
    if (env.useMockApi && req.section !== "autocomplete") {
      const mockText =
        "ТЕХНИКА ИССЛЕДОВАНИЯ:\nИсследование выполнено по стандартному протоколу.\n\nОПИСАНИЕ:\nБез патологических изменений.\n\nЗАКЛЮЧЕНИЕ:\nНорма.";
      const words = mockText.split(" ");
      for (let i = 0; i < words.length; i++) {
        if (signal?.aborted) return;
        await new Promise((r) => setTimeout(r, 50));
        onChunk({ delta: words[i] + " ", done: false });
      }
      onChunk({ delta: "", done: true, tokensUsed: words.length * 2 });
      return;
    }
    const response = await fetchAutocompleteStreamResponse(req, signal);
    await consumeAutocompleteStream(response, onChunk, signal);
  },
};
