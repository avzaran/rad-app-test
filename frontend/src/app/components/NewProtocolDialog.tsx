import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Plus, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { ScrollArea } from "./ui/scroll-area";
import type { Patient, Modality, Template } from "../types/models";
import { cn } from "./ui/utils";
import { toast } from "sonner";
import { usePatientsQuery, useCreatePatientMutation } from "../hooks/usePatients";
import { useTemplatesQuery } from "../hooks/useTemplates";
import { useCreateProtocolMutation } from "../hooks/useProtocols";
import { useProtocolTabsStore } from "../store/protocolTabsStore";

type NewProtocolDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewProtocolDialog({ open, onOpenChange }: NewProtocolDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"patient" | "modality" | "template">("patient");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const { data: patients = [] } = usePatientsQuery();
  const { data: templates = [] } = useTemplatesQuery();
  const addPatient = useCreatePatientMutation();
  const addProtocol = useCreateProtocolMutation();
  const openProtocol = useProtocolTabsStore((state) => state.openProtocol);

  const [newPatientData, setNewPatientData] = useState({
    name: "",
    birthDate: "",
    gender: "male" as "male" | "female",
    phone: "",
    email: "",
  });

  const handleReset = () => {
    setStep("patient");
    setSelectedPatient(null);
    setIsNewPatient(false);
    setSelectedModality(null);
    setSelectedTemplate(null);
    setNewPatientData({
      name: "",
      birthDate: "",
      gender: "male",
      phone: "",
      email: "",
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(handleReset, 200);
  };

  const handlePatientNext = async () => {
    let currentPatient = selectedPatient;

    if (isNewPatient) {
      if (!newPatientData.name || !newPatientData.birthDate) {
        toast.error("Заполните обязательные поля");
        return;
      }
      const newPatient = await addPatient.mutateAsync(newPatientData);
      setSelectedPatient(newPatient);
      currentPatient = newPatient;
    }

    if (!currentPatient && !isNewPatient) {
      toast.error("Выберите пациента");
      return;
    }

    setStep("modality");
  };

  const handleModalityNext = () => {
    if (!selectedModality) {
      toast.error("Выберите модальность исследования");
      return;
    }
    setStep("template");
  };

  const handleCreateProtocol = async () => {
    if (!selectedPatient || !selectedModality) {
      toast.error("Заполните все необходимые данные");
      return;
    }

    const newProtocol = await addProtocol.mutateAsync({
      patient: selectedPatient,
      modality: selectedModality,
      template: selectedTemplate,
      content: selectedTemplate?.content || "",
    });

    openProtocol({
      id: newProtocol.id,
      patient: selectedPatient,
    });
    navigate(`/protocols/${newProtocol.id}`);

    toast.success("Протокол создан");
    handleClose();
  };

  const filteredTemplates = selectedModality
    ? templates.filter((t) => t.modality === selectedModality)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Новый протокол</DialogTitle>
          <DialogDescription>
            {step === "patient" && "Выберите пациента или создайте нового"}
            {step === "modality" && "Выберите модальность исследования"}
            {step === "template" && "Выберите шаблон (необязательно)"}
          </DialogDescription>
        </DialogHeader>

        {/* Steps Indicator */}
        <div className="flex items-center gap-2 pb-6">
          {["patient", "modality", "template"].map((s, index) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : index <
                      ["patient", "modality", "template"].indexOf(step)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {index + 1}
              </div>
              {index < 2 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    index <
                      ["patient", "modality", "template"].indexOf(step)
                      ? "bg-primary"
                      : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step: Patient Selection */}
        {step === "patient" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={!isNewPatient ? "default" : "outline"}
                onClick={() => setIsNewPatient(false)}
                className="flex-1"
              >
                Выбрать из списка
              </Button>
              <Button
                variant={isNewPatient ? "default" : "outline"}
                onClick={() => setIsNewPatient(true)}
                className="flex-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                Новый пациент
              </Button>
            </div>

            {isNewPatient ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">ФИО *</Label>
                  <Input
                    id="name"
                    value={newPatientData.name}
                    onChange={(e) =>
                      setNewPatientData({ ...newPatientData, name: e.target.value })
                    }
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
                <div>
                  <Label htmlFor="birthDate">Дата рождения *</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={newPatientData.birthDate}
                    onChange={(e) =>
                      setNewPatientData({
                        ...newPatientData,
                        birthDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Пол</Label>
                  <RadioGroup
                    value={newPatientData.gender}
                    onValueChange={(value: "male" | "female") =>
                      setNewPatientData({ ...newPatientData, gender: value })
                    }
                  >
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="male" />
                        <Label htmlFor="male">Мужской</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="female" />
                        <Label htmlFor="female">Женский</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={newPatientData.phone}
                    onChange={(e) =>
                      setNewPatientData({ ...newPatientData, phone: e.target.value })
                    }
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4 space-y-2">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                        selectedPatient?.id === patient.id &&
                          "border-primary bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(patient.birthDate).toLocaleDateString("ru-RU")}
                            {patient.phone && ` • ${patient.phone}`}
                          </p>
                        </div>
                      </div>
                      {selectedPatient?.id === patient.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Отмена
              </Button>
              <Button onClick={handlePatientNext} disabled={addPatient.isPending}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {/* Step: Modality Selection */}
        {step === "modality" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: "CT", label: "КТ", desc: "Компьютерная томография" },
                { value: "MRI", label: "МРТ", desc: "Магнитно-резонансная томография" },
                { value: "X_RAY", label: "Рентген", desc: "Рентгенография" },
              ].map((modality) => (
                <button
                  key={modality.value}
                  onClick={() => setSelectedModality(modality.value as Modality)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-all hover:border-primary/50",
                    selectedModality === modality.value
                      ? "border-primary bg-accent"
                      : "border-border"
                  )}
                >
                  <div className="text-2xl font-bold">{modality.label}</div>
                  <div className="text-center text-xs text-muted-foreground">
                    {modality.desc}
                  </div>
                  {selectedModality === modality.value && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("patient")}>
                Назад
              </Button>
              <Button onClick={handleModalityNext}>Далее</Button>
            </div>
          </div>
        )}

        {/* Step: Template Selection */}
        {step === "template" && (
          <div className="space-y-4">
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-4 space-y-2">
                {filteredTemplates.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Нет доступных шаблонов для выбранной модальности
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={cn(
                        "flex w-full items-start justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                        selectedTemplate?.id === template.id &&
                          "border-primary bg-accent"
                      )}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{template.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {template.content}
                        </p>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <Check className="ml-2 h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                Шаблон можно не выбирать, протокол будет создан с пустым содержимым
              </p>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("modality")}>
                Назад
              </Button>
              <Button onClick={handleCreateProtocol} disabled={addProtocol.isPending}>
                Создать протокол
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

