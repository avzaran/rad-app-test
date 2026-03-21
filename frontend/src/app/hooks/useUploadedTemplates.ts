import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/repositories";
import type { TemplateClassificationMode } from "../types/models";

const UPLOADED_TEMPLATES_KEY = ["uploaded-templates"] as const;
const KNOWLEDGE_INDEX_JOBS_KEY = ["knowledge-index-jobs"] as const;

export function useUploadedTemplatesQuery() {
  return useQuery({
    queryKey: UPLOADED_TEMPLATES_KEY,
    queryFn: api.listUploadedTemplates,
  });
}

export function useUploadedTemplateQuery(id: string) {
  return useQuery({
    queryKey: [...UPLOADED_TEMPLATES_KEY, id],
    queryFn: () => api.getUploadedTemplate(id),
    enabled: !!id,
  });
}

export function useUploadedTemplatesByModalityQuery(modality: string) {
  return useQuery({
    queryKey: [...UPLOADED_TEMPLATES_KEY, "modality", modality],
    queryFn: () => api.getUploadedTemplatesByModality(modality),
    enabled: !!modality,
  });
}

export function useUploadTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      modality,
      studyProfile,
      tags,
      classificationMode,
    }: {
      file: File;
      modality: string;
      studyProfile: string;
      tags: string[];
      classificationMode: TemplateClassificationMode;
    }) =>
      api.uploadTemplate(file, modality, studyProfile, tags, classificationMode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UPLOADED_TEMPLATES_KEY });
    },
  });
}

export function useUploadTemplateBatchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      files,
      modality,
      studyProfile,
      tags,
      classificationMode,
    }: {
      files: File[];
      modality: string;
      studyProfile: string;
      tags: string[];
      classificationMode: TemplateClassificationMode;
    }) =>
      api.uploadTemplatesBatch({ files, modality, studyProfile, tags, classificationMode }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UPLOADED_TEMPLATES_KEY });
    },
  });
}

export function useDeleteUploadedTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteUploadedTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UPLOADED_TEMPLATES_KEY });
    },
  });
}

export function useCreateKnowledgeIndexJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      modality,
      studyProfile,
      sourceTemplateIds,
    }: {
      modality: string;
      studyProfile: string;
      sourceTemplateIds: string[];
    }) => api.createKnowledgeIndexJob({ modality, studyProfile, sourceTemplateIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UPLOADED_TEMPLATES_KEY });
    },
  });
}

export function useKnowledgeIndexJobQuery(jobId: string | null) {
  return useQuery({
    queryKey: [...KNOWLEDGE_INDEX_JOBS_KEY, jobId],
    queryFn: () => {
      if (!jobId) {
        throw new Error("Job id is required");
      }
      return api.getKnowledgeIndexJob(jobId);
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1500;
    },
  });
}
