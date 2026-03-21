import type { Modality } from "./models";

export type AISection = "description" | "conclusion" | "full" | "question" | "autocomplete";

export type AIGenerateRequest = {
  modality: Modality;
  templateContent: string;
  section: AISection;
  currentContent: string;
  userMessage?: string;
  protocolId: string;
  studyProfile?: string;
  knowledgeTags?: string[];
  sourceTemplateIds?: string[];
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

export type KnowledgeVariantOrigin = "db" | "ai_from_db" | "ai_fallback";

export type KnowledgeVariantCategory =
  | "norm"
  | "pathology"
  | "recommendation"
  | "technique"
  | "other";

export type KnowledgeSource = {
  templateId: string;
  templateName: string;
  section: string;
  category: KnowledgeVariantCategory;
};

export type KnowledgeVariant = {
  id: string;
  category: KnowledgeVariantCategory;
  text: string;
  origin: KnowledgeVariantOrigin;
  sources: KnowledgeSource[];
};

export type KnowledgeSearchRequest = {
  modality: Modality;
  studyProfile: string;
  query: string;
  knowledgeTags?: string[];
  sourceTemplateIds?: string[];
};

export type KnowledgeSearchResponse = {
  query: string;
  variants: KnowledgeVariant[];
  usedFallback: boolean;
};
