import { useState } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function TemplateContextSelector({
  modality,
  selectedIds,
  onSelectionChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: templates = [], isLoading } =
    useUploadedTemplatesByModalityQuery(modality);

  const toggleTemplate = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange(templates.map((t) => t.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">Загрузка шаблонов...</p>
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
          <span className="flex-1 font-medium">Шаблоны для контекста</span>
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {selectedIds.length}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 space-y-1 rounded-md border bg-muted/30 p-2">
          {/* Select all / Deselect all */}
          <div className="flex gap-1 pb-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={selectAll}
              disabled={selectedIds.length === templates.length}
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

          {/* Template list */}
          {templates.map((template) => (
            <label
              key={template.id}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 transition-colors hover:bg-accent"
            >
              <Checkbox
                checked={selectedIds.includes(template.id)}
                onCheckedChange={() => toggleTemplate(template.id)}
                className="mt-0.5"
              />
              <span className="line-clamp-2 text-xs leading-tight">
                {template.originalName}
              </span>
            </label>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
