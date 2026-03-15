import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import type { Modality } from "../types/models";
import { useTemplatesQuery } from "../hooks/useTemplates";

type ViewTemplateDialogProps = {
  templateId: string | null;
  onClose: () => void;
};

export function ViewTemplateDialog({
  templateId,
  onClose,
}: ViewTemplateDialogProps) {
  const { data: templates = [] } = useTemplatesQuery();
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    return null;
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

  return (
    <Dialog open={templateId !== null} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{template.name}</DialogTitle>
            <Badge className={getModalityColor(template.modality)}>
              {getModalityLabel(template.modality)}
            </Badge>
          </div>
          <DialogDescription>
            Создан{" "}
            {new Date(template.createdAt).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] rounded-md border p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm">
            {template.content}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

