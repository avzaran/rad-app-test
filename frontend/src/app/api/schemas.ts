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

export const patientsSchema = z.array(patientSchema);
export const templatesSchema = z.array(templateSchema);
export const protocolsSchema = z.array(protocolSchema);
