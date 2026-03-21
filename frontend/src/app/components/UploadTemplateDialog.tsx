import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Progress } from "./ui/progress";
import type { Modality, TemplateClassificationMode } from "../types/models";
import { toast } from "sonner";
import { Upload, X, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useUploadTemplateBatchMutation } from "../hooks/useUploadedTemplates";

type UploadTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function UploadTemplateDialog({ open, onOpenChange }: UploadTemplateDialogProps) {
  const [modality, setModality] = useState<Modality | null>(null);
  const [studyProfile, setStudyProfile] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [classificationMode, setClassificationMode] =
    useState<TemplateClassificationMode>("manual");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadBatch = useUploadTemplateBatchMutation();

  const handleReset = () => {
    setModality(null);
    setStudyProfile("");
    setTagsText("");
    setClassificationMode("manual");
    setFiles([]);
    setUploadStatus("idle");
  };

  const handleClose = () => {
    if (uploadStatus === "uploading") return;
    onOpenChange(false);
    setTimeout(handleReset, 200);
  };

  const isDocxFile = (file: File): boolean => {
    return (
      file.name.toLowerCase().endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const docxFiles = Array.from(newFiles).filter(isDocxFile);
    if (docxFiles.length < Array.from(newFiles).length) {
      toast.error("Допускаются только файлы формата .docx");
    }
    if (docxFiles.length > 0) {
      setFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const uniqueNew = docxFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...uniqueNew];
      });
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!modality) {
      toast.error("Выберите модальность");
      return;
    }
    if (!studyProfile.trim()) {
      toast.error("Укажите профиль исследования");
      return;
    }
    if (files.length === 0) {
      toast.error("Выберите файлы для загрузки");
      return;
    }

    setUploadStatus("uploading");

    try {
      await uploadBatch.mutateAsync({
        files,
        modality,
        studyProfile: studyProfile.trim(),
        tags: tagsText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        classificationMode,
      });
      setUploadStatus("success");
      toast.success(
        files.length === 1
          ? "Шаблон успешно загружен"
          : `Успешно загружено шаблонов: ${files.length}`
      );
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch {
      setUploadStatus("error");
      toast.error("Ошибка при загрузке файлов");
    }
  };

  const canUpload =
    modality !== null && studyProfile.trim().length > 0 && files.length > 0 && uploadStatus === "idle";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Загрузить шаблон</DialogTitle>
          <DialogDescription>
            Загрузите DOCX-файлы шаблонов протоколов для извлечения текста
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Модальность</Label>
            <RadioGroup
              value={modality ?? ""}
              onValueChange={(value) => setModality(value as Modality)}
            >
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CT" id="upload-ct" />
                  <Label htmlFor="upload-ct">КТ</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MRI" id="upload-mri" />
                  <Label htmlFor="upload-mri">МРТ</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="X_RAY" id="upload-xray" />
                  <Label htmlFor="upload-xray">Рентген</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="study-profile">Профиль исследования</Label>
            <Input
              id="study-profile"
              value={studyProfile}
              onChange={(e) => setStudyProfile(e.target.value)}
              placeholder="Например, МРТ головного мозга"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="upload-tags">Теги</Label>
            <Input
              id="upload-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="с контрастом, ангиография, контроль"
            />
            <p className="text-xs text-muted-foreground">
              Необязательно. Перечисляйте через запятую.
            </p>
          </div>

          <div>
            <Label>Режим классификации</Label>
            <RadioGroup
              value={classificationMode}
              onValueChange={(value) => setClassificationMode(value as TemplateClassificationMode)}
            >
              <div className="space-y-2">
                <label className="flex items-start space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="manual" id="classification-manual" className="mt-1" />
                  <div>
                    <Label htmlFor="classification-manual">Врач задаёт вручную</Label>
                    <p className="text-xs text-muted-foreground">
                      Вы используете указанный профиль и теги для всей пачки файлов.
                    </p>
                  </div>
                </label>
                <label className="flex items-start space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="ai" id="classification-ai" className="mt-1" />
                  <div>
                    <Label htmlFor="classification-ai">Делегировать ИИ</Label>
                    <p className="text-xs text-muted-foreground">
                      ИИ дополнительно разберёт содержимое и поможет отсортировать шаблоны при индексации.
                    </p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Файлы (.docx)</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              } ${uploadStatus !== "idle" ? "pointer-events-none opacity-50" : ""}`}
            >
              <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Перетащите файлы сюда или нажмите для выбора
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Поддерживается формат .docx. Можно выбрать несколько файлов.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Выбранные файлы ({files.length})</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    {uploadStatus === "idle" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadStatus === "uploading" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Загрузка файлов...
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {uploadStatus === "success" && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Файлы успешно загружены
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Ошибка загрузки. Попробуйте ещё раз.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={uploadStatus === "uploading"}>
              {uploadStatus === "success" ? "Закрыть" : "Отмена"}
            </Button>
            {uploadStatus === "error" && (
              <Button
                onClick={() => setUploadStatus("idle")}
                variant="outline"
              >
                Повторить
              </Button>
            )}
            {(uploadStatus === "idle" || uploadStatus === "error") && (
              <Button onClick={handleUpload} disabled={!canUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Загрузить
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
