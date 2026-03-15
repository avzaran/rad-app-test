import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/repositories";
import type { Patient } from "../types/models";

const PATIENTS_KEY = ["patients"] as const;

export function usePatientsQuery() {
  return useQuery({
    queryKey: PATIENTS_KEY,
    queryFn: api.listPatients,
  });
}

export function useCreatePatientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<Patient, "id">) => api.createPatient(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_KEY });
    },
  });
}
