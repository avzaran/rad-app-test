import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/repositories";
import type { Template } from "../types/models";

const TEMPLATES_KEY = ["templates"] as const;

export function useTemplatesQuery() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: api.listTemplates,
  });
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<Template, "id" | "createdAt">) =>
      api.createTemplate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });
}
