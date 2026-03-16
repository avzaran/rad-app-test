import type { Modality } from "../types/models";

export type PhraseCategory = "norm" | "pathology" | "recommendation";

export type Phrase = {
  id: string;
  text: string;
  category: PhraseCategory;
  modality: Modality | "all";
  section: "description" | "conclusion";
};

export const phrases: Phrase[] = [
  // -- CT: Description (norm) --
  {
    id: "ct-desc-lungs-norm",
    text: "Легкие расправлены, воздушность сохранена. Очаговых и инфильтративных изменений не выявлено.",
    category: "norm",
    modality: "CT",
    section: "description",
  },
  {
    id: "ct-desc-mediastinum-norm",
    text: "Органы средостения расположены обычно, не смещены. Лимфатические узлы средостения не увеличены.",
    category: "norm",
    modality: "CT",
    section: "description",
  },
  {
    id: "ct-desc-pleura-norm",
    text: "Плевральные полости свободны. Плевра не утолщена.",
    category: "norm",
    modality: "CT",
    section: "description",
  },
  {
    id: "ct-desc-bones-norm",
    text: "Костно-деструктивных изменений в зоне исследования не выявлено.",
    category: "norm",
    modality: "CT",
    section: "description",
  },

  // -- CT: Description (pathology) --
  {
    id: "ct-desc-focal",
    text: "В S{_} сегменте определяется округлое образование размерами {_}×{_} мм, плотностью {_} HU, с чёткими контурами.",
    category: "pathology",
    modality: "CT",
    section: "description",
  },
  {
    id: "ct-desc-infiltrate",
    text: "В {_} доле определяется участок инфильтрации лёгочной ткани размерами {_}×{_} мм, неоднородной структуры.",
    category: "pathology",
    modality: "CT",
    section: "description",
  },
  {
    id: "ct-desc-pleural-effusion",
    text: "В плевральной полости {_} определяется свободная жидкость толщиной до {_} мм.",
    category: "pathology",
    modality: "CT",
    section: "description",
  },

  // -- CT: Conclusion --
  {
    id: "ct-concl-norm",
    text: "КТ-картина без патологических изменений органов грудной клетки.",
    category: "norm",
    modality: "CT",
    section: "conclusion",
  },
  {
    id: "ct-concl-recommend",
    text: "Рекомендовано динамическое наблюдение через {_} месяцев.",
    category: "recommendation",
    modality: "CT",
    section: "conclusion",
  },

  // -- MRI: Description (norm) --
  {
    id: "mri-desc-brain-norm",
    text: "Структуры головного мозга дифференцированы правильно. Серое и белое вещество без очаговых изменений. Желудочковая система не расширена, симметрична.",
    category: "norm",
    modality: "MRI",
    section: "description",
  },
  {
    id: "mri-desc-midline-norm",
    text: "Срединные структуры не смещены. Базальные цистерны не деформированы.",
    category: "norm",
    modality: "MRI",
    section: "description",
  },

  // -- MRI: Description (pathology) --
  {
    id: "mri-desc-focal-lesion",
    text: "В {_} области определяется очаг патологического сигнала размерами {_}×{_} мм, гиперинтенсивный на T2 и FLAIR, гипоинтенсивный на T1.",
    category: "pathology",
    modality: "MRI",
    section: "description",
  },

  // -- MRI: Conclusion --
  {
    id: "mri-concl-norm",
    text: "МР-картина без патологических изменений головного мозга.",
    category: "norm",
    modality: "MRI",
    section: "conclusion",
  },

  // -- X_RAY: Description (norm) --
  {
    id: "xray-desc-lungs-norm",
    text: "Лёгочные поля прозрачны. Лёгочный рисунок не изменён. Корни лёгких структурны, не расширены.",
    category: "norm",
    modality: "X_RAY",
    section: "description",
  },
  {
    id: "xray-desc-heart-norm",
    text: "Сердечная тень обычной формы и размеров. Аорта не изменена.",
    category: "norm",
    modality: "X_RAY",
    section: "description",
  },
  {
    id: "xray-desc-diaphragm-norm",
    text: "Диафрагма расположена обычно, контуры чёткие. Синусы свободны.",
    category: "norm",
    modality: "X_RAY",
    section: "description",
  },

  // -- X_RAY: Conclusion --
  {
    id: "xray-concl-norm",
    text: "Рентгенологическая картина органов грудной клетки без патологических изменений.",
    category: "norm",
    modality: "X_RAY",
    section: "conclusion",
  },

  // -- Universal --
  {
    id: "all-concl-recommend-control",
    text: "Рекомендован контрольный осмотр через {_} месяцев.",
    category: "recommendation",
    modality: "all",
    section: "conclusion",
  },
  {
    id: "all-concl-recommend-consult",
    text: "Рекомендована консультация {_}.",
    category: "recommendation",
    modality: "all",
    section: "conclusion",
  },
];

export function filterPhrases(modality: Modality, section?: "description" | "conclusion"): Phrase[] {
  return phrases.filter(
    (p) =>
      (p.modality === modality || p.modality === "all") &&
      (!section || p.section === section),
  );
}

const CATEGORY_LABELS: Record<PhraseCategory, string> = {
  norm: "Норма",
  pathology: "Патология",
  recommendation: "Рекомендации",
};

export function categoryLabel(category: PhraseCategory): string {
  return CATEGORY_LABELS[category];
}
