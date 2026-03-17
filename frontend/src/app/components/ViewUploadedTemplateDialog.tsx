import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { Modality, UploadedTemplate } from "../types/models";
import { FileText, Trash2, HardDrive, Calendar, User } from "lucide-react";

type ViewUploadedTemplateDialogProps = {
  template: UploadedTemplate | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

const getModalityLabel = (modality: Modality) => {
  switch (modality) {
    case "CT":
      return "КТ";
    case "MRI":
      return "МРТ";
    case "X_RAY":
      return "Рентген";
  }
};

const getModalityColor = (modality: Modality) => {
  switch (modality) {
    case "CT":
      return "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400";
    case "MRI":
      return "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400";
    case "X_RAY":
      return "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400";
  }
};

export function ViewUploadedTemplateDialog({
  template,
  onClose,
  onDelete,
}: ViewUploadedTemplateDialogProps) {
  if (!template) {
    return null;
  }

  return (
    <Dialog open={template !== null} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {template.originalName}
            </DialogTitle>
            <Badge className={getModalityColor(template.modality)}>
              {getModalityLabel(template.modality)}
            </Badge>
          </div>
          <DialogDescription>
            Загруженный шаблон протокола
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 rounded-md border p-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            <span>{formatFileSize(template.fileSize)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(template.createdAt).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{template.uploadedBy}</span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Извлечённый текст</p>
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {template.extractedText}
            </pre>
          </ScrollArea>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {onDelete && (
            <Button
              variant="outline"
              onClick={() => onDelete(template.id)}
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
