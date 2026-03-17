import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/repositories";

const UPLOADED_TEMPLATES_KEY = ["uploaded-templates"] as const;

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
    mutationFn: ({ file, modality }: { file: File; modality: string }) =>
      api.uploadTemplate(file, modality),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UPLOADED_TEMPLATES_KEY });
    },
  });
}

export function useUploadTemplateBatchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ files, modality }: { files: File[]; modality: string }) =>
      api.uploadTemplatesBatch(files, modality),
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
