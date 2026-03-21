import { useMemo, useState } from "react";
import { FileText, ChevronRight, Tags } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { useUploadedTemplatesByModalityQuery } from "../../hooks/useUploadedTemplates";
import type { Modality } from "../../types/models";
import { cn } from "../ui/utils";

type Props = {
  modality: Modality;
  studyProfile: string;
  knowledgeTags: string[];
  selectedIds: string[];
  onStudyProfileChange: (value: string) => void;
  onKnowledgeTagsChange: (tags: string[]) => void;
  onSelectionChange: (ids: string[]) => void;
};

const statusLabel: Record<string, string> = {
  pending: "Ждет индексации",
  running: "Индексируется",
  ready: "Готов",
  failed: "Ошибка",
  needs_reindex: "Нужно переиндексировать",
};

export function TemplateContextSelector({
  modality,
  studyProfile,
  knowledgeTags,
  selectedIds,
  onStudyProfileChange,
  onKnowledgeTagsChange,
  onSelectionChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: templates = [], isLoading } =
    useUploadedTemplatesByModalityQuery(modality);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (!studyProfile.trim()) {
        return true;
      }
      return template.studyProfile.toLowerCase().includes(studyProfile.toLowerCase());
    });
  }, [studyProfile, templates]);

  const availableTags = useMemo(() => {
    return Array.from(new Set(filteredTemplates.flatMap((template) => template.tags))).sort();
  }, [filteredTemplates]);

  const toggleTemplate = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleTag = (tag: string) => {
    if (knowledgeTags.includes(tag)) {
      onKnowledgeTagsChange(knowledgeTags.filter((item) => item !== tag));
    } else {
      onKnowledgeTagsChange([...knowledgeTags, tag]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredTemplates.map((t) => t.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">Загрузка knowledge-контекста...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 font-medium">Контекст знаний</span>
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {selectedIds.length}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              Профиль исследования
            </p>
            <Input
              value={studyProfile}
              onChange={(e) => onStudyProfileChange(e.target.value)}
              placeholder="Например, МРТ головного мозга"
              className="h-8 text-xs"
            />
          </div>

          {availableTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Tags className="h-3 w-3" />
                Теги
              </div>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={knowledgeTags.includes(tag) ? "default" : "outline"}
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={selectAll}
              disabled={selectedIds.length === filteredTemplates.length}
            >
              Выбрать все
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={deselectAll}
              disabled={selectedIds.length === 0}
            >
              Снять все
            </Button>
          </div>

          <div className="space-y-1">
            {filteredTemplates.map((template) => (
              <label
                key={template.id}
                className="flex cursor-pointer items-start gap-2 rounded border bg-background/70 px-2 py-2 transition-colors hover:bg-accent"
              >
                <Checkbox
                  checked={selectedIds.includes(template.id)}
                  onCheckedChange={() => toggleTemplate(template.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">
                      {template.originalName}
                    </span>
                    <Badge variant="outline" className="text-[9px]">
                      {statusLabel[template.indexStatus] ?? template.indexStatus}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {template.studyProfile}
                  </p>
                  {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Для выбранного профиля пока нет шаблонов
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
