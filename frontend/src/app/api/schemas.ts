import { z } from "zod";

export const patientSchema = z.object({
  id: z.string(),
  name: z.string(),
  birthDate: z.string(),
  gender: z.enum(["male", "female"]),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  modality: z.enum(["CT", "MRI", "X_RAY"]),
  content: z.string(),
  createdAt: z.string(),
});

export const protocolSchema = z.object({
  id: z.string(),
  patient: patientSchema,
  modality: z.enum(["CT", "MRI", "X_RAY"]),
  template: templateSchema.nullable(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["draft", "completed"]),
});

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(["admin", "doctor"]),
  twoFaEnabled: z.boolean(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});

export const uploadedTemplateSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  originalName: z.string(),
  modality: z.enum(["CT", "MRI", "X_RAY"]),
  studyProfile: z.string(),
  tags: z.array(z.string()),
  classificationMode: z.enum(["manual", "ai"]),
  extractedText: z.string(),
  fileSize: z.number(),
  uploadedBy: z.string(),
  indexStatus: z.enum(["pending", "running", "ready", "failed", "needs_reindex"]),
  lastIndexedAt: z.string().nullable().optional(),
  lastIndexError: z.string().optional(),
  createdAt: z.string(),
});

export const templateIndexJobSchema = z.object({
  id: z.string(),
  createdBy: z.string(),
  modality: z.enum(["CT", "MRI", "X_RAY"]),
  studyProfile: z.string(),
  sourceTemplateIds: z.array(z.string()),
  status: z.enum(["pending", "running", "completed", "failed"]),
  totalTemplates: z.number(),
  processedTemplates: z.number(),
  lastError: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  lastHeartbeatAt: z.string().nullable().optional(),
});

export const knowledgeSourceSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  section: z.string(),
  category: z.enum(["norm", "pathology", "recommendation", "technique", "other"]),
});

export const knowledgeVariantSchema = z.object({
  id: z.string(),
  category: z.enum(["norm", "pathology", "recommendation", "technique", "other"]),
  text: z.string(),
  origin: z.enum(["db", "ai_from_db", "ai_fallback"]),
  sources: z.array(knowledgeSourceSchema),
});

export const knowledgeSearchResponseSchema = z.object({
  query: z.string(),
  variants: z.array(knowledgeVariantSchema),
  usedFallback: z.boolean(),
});

export const patientsSchema = z.array(patientSchema);
export const templatesSchema = z.array(templateSchema);
export const protocolsSchema = z.array(protocolSchema);
export const uploadedTemplatesSchema = z.array(uploadedTemplateSchema);
