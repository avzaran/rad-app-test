import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/repositories";
import type { Protocol } from "../types/models";

const PROTOCOLS_KEY = ["protocols"] as const;

export function useProtocolsQuery() {
  return useQuery({
    queryKey: PROTOCOLS_KEY,
    queryFn: api.listProtocols,
  });
}

export function useProtocolQuery(protocolId: string | undefined) {
  return useQuery({
    queryKey: [...PROTOCOLS_KEY, protocolId],
    enabled: Boolean(protocolId),
    queryFn: async () => {
      if (!protocolId) {
        return null;
      }
      return api.getProtocol(protocolId);
    },
  });
}

export function useCreateProtocolMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<Protocol, "id" | "createdAt" | "updatedAt" | "status">) =>
      api.createProtocol(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROTOCOLS_KEY });
    },
  });
}

export function useUpdateProtocolMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Protocol> }) =>
      api.updateProtocol(id, patch),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: PROTOCOLS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...PROTOCOLS_KEY, variables.id] });
    },
  });
}
