import { useState } from "react";
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
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import type { Modality } from "../types/models";
import { toast } from "sonner";
import { useCreateTemplateMutation } from "../hooks/useTemplates";

type NewTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewTemplateDialog({ open, onOpenChange }: NewTemplateDialogProps) {
  const [name, setName] = useState("");
  const [modality, setModality] = useState<Modality>("CT");
  const [content, setContent] = useState("");

  const addTemplate = useCreateTemplateMutation();

  const handleReset = () => {
    setName("");
    setModality("CT");
    setContent("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(handleReset, 200);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Введите название шаблона");
      return;
    }

    if (!content.trim()) {
      toast.error("Введите содержимое шаблона");
      return;
    }

    const newTemplate = {
      name: name.trim(),
      modality,
      content: content.trim(),
    };

    await addTemplate.mutateAsync(newTemplate);
    toast.success("Шаблон создан");
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Новый шаблон</DialogTitle>
          <DialogDescription>
            Создайте шаблон протокола для быстрого заполнения
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Название шаблона</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: КТ органов грудной клетки"
            />
          </div>

          <div>
            <Label>Модальность</Label>
            <RadioGroup
              value={modality}
              onValueChange={(value: Modality) => setModality(value)}
            >
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CT" id="ct" />
                  <Label htmlFor="ct">КТ</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MRI" id="mri" />
                  <Label htmlFor="mri">МРТ</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="X_RAY" id="xray" />
                  <Label htmlFor="xray">Рентген</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="content">Содержимое шаблона</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Введите текст шаблона..."
              rows={12}
              className="font-mono text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Используйте стандартную структуру протокола: техника исследования,
              описание, заключение
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={addTemplate.isPending}>
              Создать шаблон
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

