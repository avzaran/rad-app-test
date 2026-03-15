import type { Patient, Protocol, Template } from "../types/models";
import type { AuthUser, LoginRequest, LoginResponse, RefreshResponse } from "../types/auth";

const STORAGE_KEY = "radassist-mock-db-v2";

type MockDb = {
  patients: Patient[];
  templates: Template[];
  protocols: Protocol[];
  users: Array<AuthUser & { password: string }>;
  refreshTokens: Record<string, string>;
};

const seedPatients: Patient[] = [
  {
    id: "1",
    name: "Иванов Иван Иванович",
    birthDate: "1975-05-15",
    gender: "male",
    phone: "+7 (999) 123-45-67",
  },
  {
    id: "2",
    name: "Петрова Мария Сергеевна",
    birthDate: "1988-11-23",
    gender: "female",
    phone: "+7 (999) 987-65-43",
  },
  {
    id: "3",
    name: "Сидоров Петр Александрович",
    birthDate: "1992-03-08",
    gender: "male",
  },
];

const seedTemplates: Template[] = [
  {
    id: "1",
    name: "КТ органов грудной клетки",
    modality: "CT",
    content:
      "ТЕХНИКА ИССЛЕДОВАНИЯ:\nКТ органов грудной клетки выполнена в аксиальной проекции...\n\nОПИСАНИЕ:\nЛегкие: без очаговых и инфильтративных изменений...\n\nЗАКЛЮЧЕНИЕ:",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "2",
    name: "МРТ головного мозга",
    modality: "MRI",
    content:
      "ТЕХНИКА ИССЛЕДОВАНИЯ:\nМРТ головного мозга выполнена в сагиттальной, аксиальной и корональной проекциях...\n\nОПИСАНИЕ:\nСтруктуры головного мозга...\n\nЗАКЛЮЧЕНИЕ:",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "3",
    name: "Рентгенография легких",
    modality: "X_RAY",
    content:
      "ТЕХНИКА ИССЛЕДОВАНИЯ:\nРентгенография органов грудной клетки в прямой проекции...\n\nОПИСАНИЕ:\nЛегочные поля: прозрачность сохранена...\n\nЗАКЛЮЧЕНИЕ:",
    createdAt: "2026-01-15T10:00:00Z",
  },
];

const seedProtocols: Protocol[] = [
  {
    id: "1",
    patient: seedPatients[0],
    modality: "CT",
    template: seedTemplates[0],
    content: seedTemplates[0].content,
    createdAt: "2026-03-15T08:30:00Z",
    updatedAt: "2026-03-15T08:45:00Z",
    status: "completed",
  },
  {
    id: "2",
    patient: seedPatients[1],
    modality: "MRI",
    template: seedTemplates[1],
    content: seedTemplates[1].content,
    createdAt: "2026-03-15T09:15:00Z",
    updatedAt: "2026-03-15T09:30:00Z",
    status: "draft",
  },
];

const seedUsers: Array<AuthUser & { password: string }> = [
  {
    id: "u-admin",
    email: "admin@radassist.local",
    fullName: "Администратор",
    role: "admin",
    twoFaEnabled: true,
    password: "admin123",
  },
  {
    id: "u-doctor",
    email: "doctor@radassist.local",
    fullName: "Врач-рентгенолог",
    role: "doctor",
    twoFaEnabled: false,
    password: "doctor123",
  },
];

function readDb(): MockDb {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial: MockDb = {
      patients: seedPatients,
      templates: seedTemplates,
      protocols: seedProtocols,
      users: seedUsers,
      refreshTokens: {},
    };
    writeDb(initial);
    return initial;
  }

  return JSON.parse(raw) as MockDb;
}

function writeDb(db: MockDb): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function token(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const mockDb = {
  listPatients: async (): Promise<Patient[]> => readDb().patients,
  createPatient: async (payload: Omit<Patient, "id">): Promise<Patient> => {
    const db = readDb();
    const patient: Patient = { id: token(), ...payload };
    db.patients = [...db.patients, patient];
    writeDb(db);
    return patient;
  },
  listTemplates: async (): Promise<Template[]> => readDb().templates,
  createTemplate: async (payload: Omit<Template, "id" | "createdAt">): Promise<Template> => {
    const db = readDb();
    const template: Template = {
      id: token(),
      createdAt: new Date().toISOString(),
      ...payload,
    };
    db.templates = [...db.templates, template];
    writeDb(db);
    return template;
  },
  deleteTemplate: async (id: string): Promise<void> => {
    const db = readDb();
    db.templates = db.templates.filter((item) => item.id !== id);
    writeDb(db);
  },
  listProtocols: async (): Promise<Protocol[]> => readDb().protocols,
  getProtocol: async (id: string): Promise<Protocol | null> => {
    const db = readDb();
    return db.protocols.find((item) => item.id === id) ?? null;
  },
  createProtocol: async (
    payload: Omit<Protocol, "id" | "createdAt" | "updatedAt" | "status">
  ): Promise<Protocol> => {
    const db = readDb();
    const protocol: Protocol = {
      id: token(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
      ...payload,
    };
    db.protocols = [...db.protocols, protocol];
    writeDb(db);
    return protocol;
  },
  updateProtocol: async (id: string, patch: Partial<Protocol>): Promise<Protocol> => {
    const db = readDb();
    const found = db.protocols.find((item) => item.id === id);
    if (!found) {
      throw new Error("Protocol not found");
    }

    const updated: Protocol = {
      ...found,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    db.protocols = db.protocols.map((item) => (item.id === id ? updated : item));
    writeDb(db);
    return updated;
  },
  login: async (payload: LoginRequest): Promise<LoginResponse> => {
    const db = readDb();
    const user = db.users.find(
      (candidate) =>
        candidate.email.toLowerCase() === payload.email.toLowerCase() &&
        candidate.password === payload.password
    );

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const refresh = token();
    db.refreshTokens[refresh] = user.id;
    writeDb(db);

    const { password, ...safeUser } = user;
    window.localStorage.setItem("radassist-mock-refresh", refresh);

    return {
      accessToken: token(),
      user: safeUser,
    };
  },
  refresh: async (): Promise<RefreshResponse> => {
    const refresh = window.localStorage.getItem("radassist-mock-refresh");
    const db = readDb();

    if (!refresh || !db.refreshTokens[refresh]) {
      throw new Error("Refresh token expired");
    }

    return { accessToken: token() };
  },
  me: async (): Promise<AuthUser> => {
    const refresh = window.localStorage.getItem("radassist-mock-refresh");
    const db = readDb();

    if (!refresh) {
      throw new Error("Not authenticated");
    }

    const userId = db.refreshTokens[refresh];
    const user = db.users.find((candidate) => candidate.id === userId);

    if (!user) {
      throw new Error("Not authenticated");
    }

    const { password, ...safeUser } = user;
    return safeUser;
  },
  logout: async (): Promise<void> => {
    const refresh = window.localStorage.getItem("radassist-mock-refresh");
    const db = readDb();
    if (refresh) {
      delete db.refreshTokens[refresh];
      window.localStorage.removeItem("radassist-mock-refresh");
      writeDb(db);
    }
  },
};
