import { useMemo, useState } from "react";
import { Search, FileText, Trash2, Eye, Upload, DatabaseZap } from "lucide-react";
import type { Modality, UploadedTemplate } from "../types/models";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
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
  useCreateKnowledgeIndexJobMutation,
  useKnowledgeIndexJobQuery,
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

const indexStatusColor: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  running: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  needs_reindex: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

const indexStatusLabel: Record<string, string> = {
  pending: "Ждет",
  running: "В работе",
  ready: "Готово",
  completed: "Готово",
  failed: "Ошибка",
  needs_reindex: "Переиндексировать",
};

export function UploadedTemplatesList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModality, setFilterModality] = useState<Modality | "all">("all");
  const [viewingTemplate, setViewingTemplate] = useState<UploadedTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data: uploadedTemplates = [], isLoading } = useUploadedTemplatesQuery();
  const deleteTemplate = useDeleteUploadedTemplateMutation();
  const createIndexJob = useCreateKnowledgeIndexJobMutation();
  const activeJob = useKnowledgeIndexJobQuery(activeJobId);

  const filteredTemplates = uploadedTemplates.filter((template) => {
    const matchesSearch =
      template.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.studyProfile.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesModality =
      filterModality === "all" || template.modality === filterModality;
    return matchesSearch && matchesModality;
  });

  const indexableSelection = useMemo(() => {
    if (filteredTemplates.length === 0) {
      return null;
    }
    const [first] = filteredTemplates;
    const sameScope = filteredTemplates.every(
      (item) =>
        item.modality === first.modality && item.studyProfile === first.studyProfile,
    );
    if (!sameScope) {
      return null;
    }
    return {
      modality: first.modality,
      studyProfile: first.studyProfile,
      sourceTemplateIds: filteredTemplates.map((item) => item.id),
    };
  }, [filteredTemplates]);

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

  const handleStartIndexing = async () => {
    if (!indexableSelection) {
      toast.error("Для запуска индексации выберите шаблоны одного профиля исследования");
      return;
    }

    try {
      const job = await createIndexJob.mutateAsync(indexableSelection);
      setActiveJobId(job.id);
      toast.success("Структуризация шаблонов запущена");
    } catch {
      toast.error("Не удалось запустить индексацию");
    }
  };

  const progressValue = activeJob.data
    ? Math.round((activeJob.data.processedTemplates / Math.max(activeJob.data.totalTemplates, 1)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="relative min-w-[16rem] flex-1">
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
        <Button
          variant="secondary"
          onClick={handleStartIndexing}
          disabled={!indexableSelection || createIndexJob.isPending}
        >
          <DatabaseZap className="mr-2 h-4 w-4" />
          Структурировать и индексировать
        </Button>
      </div>

      {activeJob.data && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Фоновая индексация шаблонов</p>
              <p className="text-xs text-muted-foreground">
                {activeJob.data.studyProfile} • {getModalityLabel(activeJob.data.modality)}
              </p>
            </div>
            <Badge className={indexStatusColor[activeJob.data.status] ?? ""}>
              {indexStatusLabel[activeJob.data.status] ?? activeJob.data.status}
            </Badge>
          </div>
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Обработано {activeJob.data.processedTemplates} из {activeJob.data.totalTemplates}
          </p>
          {activeJob.data.lastError && (
            <p className="text-xs text-destructive">{activeJob.data.lastError}</p>
          )}
        </Card>
      )}

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
                <TableHead>Профиль</TableHead>
                <TableHead>Модальность</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Размер</TableHead>
                <TableHead>Дата загрузки</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <span className="block truncate font-medium">
                          {template.originalName}
                        </span>
                        {template.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {template.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[9px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.studyProfile}
                  </TableCell>
                  <TableCell>
                    <Badge className={getModalityColor(template.modality)}>
                      {getModalityLabel(template.modality)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={indexStatusColor[template.indexStatus] ?? ""}>
                      {indexStatusLabel[template.indexStatus] ?? template.indexStatus}
                    </Badge>
                    {template.lastIndexError && (
                      <p className="mt-1 max-w-48 text-[10px] text-destructive">
                        {template.lastIndexError}
                      </p>
                    )}
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
        onDelete={(id) => setDeletingTemplateId(id)}
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
