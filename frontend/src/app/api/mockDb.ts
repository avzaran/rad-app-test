import type {
  Patient,
  Protocol,
  Template,
  UploadedTemplate,
  Modality,
  TemplateIndexJob,
  TemplateClassificationMode,
} from "../types/models";
import type { AuthUser, LoginRequest, LoginResponse, RefreshResponse } from "../types/auth";
import type { KnowledgeSearchRequest, KnowledgeSearchResponse, KnowledgeVariant } from "../types/ai";

const STORAGE_KEY = "radassist-mock-db-v3";

type MockDb = {
  patients: Patient[];
  templates: Template[];
  protocols: Protocol[];
  uploadedTemplates: UploadedTemplate[];
  knowledgeIndexJobs: TemplateIndexJob[];
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

const seedUploadedTemplates: UploadedTemplate[] = [
  {
    id: "ut-1",
    fileName: "ct_chest_template_ut1.docx",
    originalName: "КТ_грудной_клетки_шаблон.docx",
    modality: "CT",
    studyProfile: "КТ органов грудной клетки",
    tags: ["без контраста", "стандарт"],
    classificationMode: "manual",
    extractedText:
      "ТЕХНИКА ИССЛЕДОВАНИЯ:\nКТ органов грудной клетки выполнена по стандартному протоколу.\n\nОПИСАНИЕ:\nЛегочные поля без очаговых и инфильтративных изменений. Трахея и крупные бронхи проходимы. Средостение не расширено.\n\nЗАКЛЮЧЕНИЕ:\nПатологических изменений не выявлено.",
    fileSize: 24576,
    uploadedBy: "u-admin",
    indexStatus: "ready",
    lastIndexedAt: "2026-02-10T14:45:00Z",
    lastIndexError: "",
    createdAt: "2026-02-10T14:30:00Z",
  },
  {
    id: "ut-2",
    fileName: "mri_brain_template_ut2.docx",
    originalName: "МРТ_головного_мозга_стандарт.docx",
    modality: "MRI",
    studyProfile: "МРТ головного мозга",
    tags: ["без контраста", "стандарт"],
    classificationMode: "manual",
    extractedText:
      "ТЕХНИКА ИССЛЕДОВАНИЯ:\nМРТ головного мозга выполнена в стандартных режимах (Т1, Т2, FLAIR, DWI).\n\nОПИСАНИЕ:\nСтруктуры головного мозга без патологических изменений. Мозолистое тело обычной толщины и сигнальных характеристик. Желудочковая система не расширена. Срединные структуры не смещены.\n\nЗАКЛЮЧЕНИЕ:\nДанных за патологические изменения головного мозга не получено.",
    fileSize: 31744,
    uploadedBy: "u-doctor",
    indexStatus: "ready",
    lastIndexedAt: "2026-02-12T09:30:00Z",
    lastIndexError: "",
    createdAt: "2026-02-12T09:15:00Z",
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
      uploadedTemplates: seedUploadedTemplates,
      knowledgeIndexJobs: [],
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
  listUploadedTemplates: async (): Promise<UploadedTemplate[]> => {
    const db = readDb();
    return db.uploadedTemplates ?? [];
  },
  getUploadedTemplate: async (id: string): Promise<UploadedTemplate> => {
    const db = readDb();
    const found = (db.uploadedTemplates ?? []).find((item) => item.id === id);
    if (!found) {
      throw new Error("Uploaded template not found");
    }
    return found;
  },
  getUploadedTemplatesByModality: async (modality: string): Promise<UploadedTemplate[]> => {
    const db = readDb();
    return (db.uploadedTemplates ?? []).filter((item) => item.modality === modality);
  },
  uploadTemplate: async (
    file: File,
    modality: Modality,
    studyProfile: string,
    tags: string[],
    classificationMode: TemplateClassificationMode,
  ): Promise<UploadedTemplate> => {
    await new Promise((r) => setTimeout(r, 600));
    const db = readDb();
    const id = token();
    const uploaded: UploadedTemplate = {
      id,
      fileName: `${file.name.replace(/\.docx$/i, "")}_${id}.docx`,
      originalName: file.name,
      modality,
      studyProfile,
      tags,
      classificationMode,
      extractedText: `[Извлечённый текст из файла "${file.name}"]\n\nТЕХНИКА ИССЛЕДОВАНИЯ:\nИсследование выполнено по стандартному протоколу.\n\nОПИСАНИЕ:\nБез патологических изменений.\n\nЗАКЛЮЧЕНИЕ:\nНорма.`,
      fileSize: file.size,
      uploadedBy: "u-doctor",
      indexStatus: "pending",
      lastIndexedAt: null,
      lastIndexError: "",
      createdAt: new Date().toISOString(),
    };
    db.uploadedTemplates = [...(db.uploadedTemplates ?? []), uploaded];
    writeDb(db);
    return uploaded;
  },
  uploadTemplatesBatch: async (
    files: File[],
    modality: Modality,
    studyProfile: string,
    tags: string[],
    classificationMode: TemplateClassificationMode,
  ): Promise<UploadedTemplate[]> => {
    const results: UploadedTemplate[] = [];
    for (const file of files) {
      await new Promise((r) => setTimeout(r, 400));
      const db = readDb();
      const id = token();
      const uploaded: UploadedTemplate = {
        id,
        fileName: `${file.name.replace(/\.docx$/i, "")}_${id}.docx`,
        originalName: file.name,
        modality,
        studyProfile,
        tags,
        classificationMode,
        extractedText: `[Извлечённый текст из файла "${file.name}"]\n\nТЕХНИКА ИССЛЕДОВАНИЯ:\nИсследование выполнено по стандартному протоколу.\n\nОПИСАНИЕ:\nБез патологических изменений.\n\nЗАКЛЮЧЕНИЕ:\nНорма.`,
        fileSize: file.size,
        uploadedBy: "u-doctor",
        indexStatus: "pending",
        lastIndexedAt: null,
        lastIndexError: "",
        createdAt: new Date().toISOString(),
      };
      db.uploadedTemplates = [...(db.uploadedTemplates ?? []), uploaded];
      writeDb(db);
      results.push(uploaded);
    }
    return results;
  },
  deleteUploadedTemplate: async (id: string): Promise<void> => {
    const db = readDb();
    db.uploadedTemplates = (db.uploadedTemplates ?? []).filter((item) => item.id !== id);
    writeDb(db);
  },
  createKnowledgeIndexJob: async ({
    modality,
    studyProfile,
    sourceTemplateIds,
  }: {
    modality: string;
    studyProfile: string;
    sourceTemplateIds: string[];
  }): Promise<TemplateIndexJob> => {
    const db = readDb();
    const job: TemplateIndexJob = {
      id: token(),
      createdBy: "u-doctor",
      modality: modality as Modality,
      studyProfile,
      sourceTemplateIds,
      status: "running",
      totalTemplates: sourceTemplateIds.length,
      processedTemplates: 0,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: null,
      lastHeartbeatAt: new Date().toISOString(),
    };
    db.knowledgeIndexJobs = [...(db.knowledgeIndexJobs ?? []), job];
    db.uploadedTemplates = db.uploadedTemplates.map((item) =>
      sourceTemplateIds.includes(item.id)
        ? { ...item, indexStatus: "running", lastIndexError: "" }
        : item,
    );
    writeDb(db);
    return job;
  },
  getKnowledgeIndexJob: async (id: string): Promise<TemplateIndexJob> => {
    const db = readDb();
    const job = (db.knowledgeIndexJobs ?? []).find((item) => item.id === id);
    if (!job) {
      throw new Error("Knowledge index job not found");
    }

    if (job.status === "running") {
      const finishedAt = new Date().toISOString();
      const completed: TemplateIndexJob = {
        ...job,
        status: "completed",
        processedTemplates: job.totalTemplates,
        finishedAt,
        lastHeartbeatAt: finishedAt,
      };
      db.knowledgeIndexJobs = db.knowledgeIndexJobs.map((item) =>
        item.id === id ? completed : item,
      );
      db.uploadedTemplates = db.uploadedTemplates.map((item) =>
        completed.sourceTemplateIds.includes(item.id)
          ? { ...item, indexStatus: "ready", lastIndexedAt: finishedAt, lastIndexError: "" }
          : item,
      );
      writeDb(db);
      return completed;
    }

    return job;
  },
  searchKnowledge: async (payload: KnowledgeSearchRequest): Promise<KnowledgeSearchResponse> => {
    const db = readDb();
    const query = payload.query.trim().toLowerCase();
    const selected = db.uploadedTemplates.filter((item) => {
      if (item.modality !== payload.modality) return false;
      if (payload.studyProfile && item.studyProfile !== payload.studyProfile) return false;
      if (payload.sourceTemplateIds?.length && !payload.sourceTemplateIds.includes(item.id)) return false;
      if (payload.knowledgeTags?.length && !payload.knowledgeTags.every((tag) => item.tags.includes(tag))) return false;
      return item.indexStatus === "ready";
    });

    const variants: KnowledgeVariant[] = [];
    for (const template of selected) {
      const paragraphs = template.extractedText.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      for (const paragraph of paragraphs) {
        if (query && !paragraph.toLowerCase().includes(query)) continue;
        variants.push({
          id: `${template.id}-${paragraph.slice(0, 12)}`,
          category: paragraph.toLowerCase().includes("патолог") || paragraph.toLowerCase().includes("очаг") ? "pathology" : "norm",
          text: paragraph,
          origin: "db",
          sources: [
            {
              templateId: template.id,
              templateName: template.originalName,
              section: paragraph.includes("ЗАКЛЮЧЕНИЕ") ? "conclusion" : "description",
              category: paragraph.toLowerCase().includes("патолог") || paragraph.toLowerCase().includes("очаг") ? "pathology" : "norm",
            },
          ],
        });
      }
    }

    if (variants.length === 0 && query) {
      return {
        query: payload.query,
        usedFallback: true,
        variants: [
          {
            id: token(),
            category: "norm",
            text: `Мозолистое тело обычной формы, толщины и сигнальных характеристик.`,
            origin: "ai_fallback",
            sources: [],
          },
          {
            id: token(),
            category: "pathology",
            text: `Мозолистое тело истончено, структура его неоднородна за счет очаговых изменений сигнала.`,
            origin: "ai_fallback",
            sources: [],
          },
        ],
      };
    }

    return {
      query: payload.query,
      usedFallback: false,
      variants: variants.slice(0, 8),
    };
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
