import type { Modality } from "./models";

export type AISection = "description" | "conclusion" | "full" | "question" | "autocomplete";

export type AIGenerateRequest = {
  modality: Modality;
  templateContent: string;
  section: AISection;
  currentContent: string;
  userMessage?: string;
  protocolId: string;
  uploadedTemplateIds?: string[];
};

export type AIGenerateResponse = {
  text: string;
  tokensUsed: number;
};

export type AIStreamChunk = {
  delta: string;
  done: boolean;
  tokensUsed?: number;
  error?: string;
};
