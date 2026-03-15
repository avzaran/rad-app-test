import { useState } from "react";
import { Plus, Search, FileStack, Trash2, Eye } from "lucide-react";
import type { Modality } from "../types/models";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { NewTemplateDialog } from "../components/NewTemplateDialog";
import { ViewTemplateDialog } from "../components/ViewTemplateDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { useDeleteTemplateMutation, useTemplatesQuery } from "../hooks/useTemplates";
import { useAuthStore } from "../store/authStore";

export function Templates() {
  const [isNewTemplateOpen, setIsNewTemplateOpen] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModality, setFilterModality] = useState<Modality | "all">("all");

  const { data: templates = [], isLoading } = useTemplatesQuery();
  const deleteTemplate = useDeleteTemplateMutation();
  const user = useAuthStore((state) => state.user);

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModality = filterModality === "all" || template.modality === filterModality;
    return matchesSearch && matchesModality;
  });

  const handleDeleteTemplate = () => {
    if (!deletingTemplate) {
      return;
    }

    if (user?.role !== "admin") {
      toast.error("Удаление шаблонов доступно только администратору");
      setDeletingTemplate(null);
      return;
    }

    deleteTemplate.mutate(deletingTemplate, {
      onSuccess: () => {
        toast.success("Шаблон удален");
        setDeletingTemplate(null);
      },
    });
  };

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

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Шаблоны</h1>
          <p className="mt-2 text-muted-foreground">Управление шаблонами протоколов</p>
        </div>
        <Button onClick={() => setIsNewTemplateOpen(true)} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Новый шаблон
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск шаблонов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant={filterModality === "all" ? "default" : "outline"} onClick={() => setFilterModality("all")}>Все</Button>
          <Button variant={filterModality === "CT" ? "default" : "outline"} onClick={() => setFilterModality("CT")}>КТ</Button>
          <Button variant={filterModality === "MRI" ? "default" : "outline"} onClick={() => setFilterModality("MRI")}>МРТ</Button>
          <Button variant={filterModality === "X_RAY" ? "default" : "outline"} onClick={() => setFilterModality("X_RAY")}>Рентген</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full p-6 text-sm text-muted-foreground">Загрузка шаблонов...</Card>
        ) : null}

        {!isLoading && filteredTemplates.length === 0 ? (
          <Card className="col-span-full p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-muted p-4">
                <FileStack className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Нет шаблонов</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery || filterModality !== "all"
                  ? "Шаблоны не найдены. Попробуйте изменить фильтры."
                  : "Создайте первый шаблон, нажав кнопку выше."}
              </p>
            </div>
          </Card>
        ) : !isLoading ? (
          filteredTemplates.map((template) => (
            <Card key={template.id} className="group relative flex flex-col p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-start justify-between">
                <Badge className={getModalityColor(template.modality)}>{getModalityLabel(template.modality)}</Badge>
              </div>

              <h3 className="mb-2 text-lg font-semibold">{template.name}</h3>
              <p className="mb-4 flex-1 line-clamp-3 text-sm text-muted-foreground">{template.content}</p>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewingTemplate(template.id)} className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />
                  Просмотр
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingTemplate(template.id)}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        ) : null}
      </div>

      <NewTemplateDialog open={isNewTemplateOpen} onOpenChange={setIsNewTemplateOpen} />

      <ViewTemplateDialog templateId={viewingTemplate} onClose={() => setViewingTemplate(null)} />

      <AlertDialog open={deletingTemplate !== null} onOpenChange={() => setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Шаблон будет удален навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
