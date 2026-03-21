export type Patient = {
  id: string;
  name: string;
  birthDate: string;
  gender: "male" | "female";
  phone?: string;
  email?: string;
};

export type Modality = "CT" | "MRI" | "X_RAY";

export type Template = {
  id: string;
  name: string;
  modality: Modality;
  content: string;
  createdAt: string;
};

export type Protocol = {
  id: string;
  patient: Patient;
  modality: Modality;
  template: Template | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "completed";
};

export type OpenProtocol = {
  id: string;
  patient: Patient;
};

export type TemplateClassificationMode = "manual" | "ai";

export type TemplateIndexStatus =
  | "pending"
  | "running"
  | "ready"
  | "failed"
  | "needs_reindex";

export interface UploadedTemplate {
  id: string;
  fileName: string;
  originalName: string;
  modality: Modality;
  studyProfile: string;
  tags: string[];
  classificationMode: TemplateClassificationMode;
  extractedText: string;
  fileSize: number;
  uploadedBy: string;
  indexStatus: TemplateIndexStatus;
  lastIndexedAt?: string | null;
  lastIndexError?: string;
  createdAt: string;
}

export type TemplateIndexJobStatus = "pending" | "running" | "completed" | "failed";

export type TemplateIndexJob = {
  id: string;
  createdBy: string;
  modality: Modality;
  studyProfile: string;
  sourceTemplateIds: string[];
  status: TemplateIndexJobStatus;
  totalTemplates: number;
  processedTemplates: number;
  lastError?: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastHeartbeatAt?: string | null;
};
