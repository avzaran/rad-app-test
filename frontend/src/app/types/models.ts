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
