import { useState } from "react";
import { Search, FileText, Trash2, Eye, Upload } from "lucide-react";
import type { Modality, UploadedTemplate } from "../types/models";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { toast } from "sonner";
import { ViewUploadedTemplateDialog } from "./ViewUploadedTemplateDialog";
import {
  useUploadedTemplatesQuery,
  useDeleteUploadedTemplateMutation,
} from "../hooks/useUploadedTemplates";

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
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "MRI":
      return "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400";
    case "X_RAY":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
  }
};

export function UploadedTemplatesList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModality, setFilterModality] = useState<Modality | "all">("all");
  const [viewingTemplate, setViewingTemplate] = useState<UploadedTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const { data: uploadedTemplates = [], isLoading } = useUploadedTemplatesQuery();
  const deleteTemplate = useDeleteUploadedTemplateMutation();

  const filteredTemplates = uploadedTemplates.filter((template) => {
    const matchesSearch = template.originalName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesModality =
      filterModality === "all" || template.modality === filterModality;
    return matchesSearch && matchesModality;
  });

  const handleDelete = () => {
    if (!deletingTemplateId) return;

    deleteTemplate.mutate(deletingTemplateId, {
      onSuccess: () => {
        toast.success("Загруженный шаблон удалён");
        setDeletingTemplateId(null);
        if (viewingTemplate?.id === deletingTemplateId) {
          setViewingTemplate(null);
        }
      },
      onError: () => {
        toast.error("Ошибка при удалении шаблона");
      },
    });
  };

  const handleDeleteFromView = (id: string) => {
    setDeletingTemplateId(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск загруженных шаблонов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterModality === "all" ? "default" : "outline"}
            onClick={() => setFilterModality("all")}
          >
            Все
          </Button>
          <Button
            variant={filterModality === "CT" ? "default" : "outline"}
            onClick={() => setFilterModality("CT")}
          >
            КТ
          </Button>
          <Button
            variant={filterModality === "MRI" ? "default" : "outline"}
            onClick={() => setFilterModality("MRI")}
          >
            МРТ
          </Button>
          <Button
            variant={filterModality === "X_RAY" ? "default" : "outline"}
            onClick={() => setFilterModality("X_RAY")}
          >
            Рентген
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Загрузка шаблонов...
        </Card>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-4">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              Нет загруженных шаблонов
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery || filterModality !== "all"
                ? "Шаблоны не найдены. Попробуйте изменить фильтры."
                : "Загрузите DOCX-файлы шаблонов, нажав кнопку выше."}
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Модальность</TableHead>
                <TableHead>Размер</TableHead>
                <TableHead>Дата загрузки</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="truncate font-medium">
                        {template.originalName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getModalityColor(template.modality)}>
                      {getModalityLabel(template.modality)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(template.fileSize)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(template.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingTemplate(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingTemplateId(template.id)}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ViewUploadedTemplateDialog
        template={viewingTemplate}
        onClose={() => setViewingTemplate(null)}
        onDelete={handleDeleteFromView}
      />

      <AlertDialog
        open={deletingTemplateId !== null}
        onOpenChange={() => setDeletingTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить загруженный шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Загруженный шаблон будет удалён
              навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
