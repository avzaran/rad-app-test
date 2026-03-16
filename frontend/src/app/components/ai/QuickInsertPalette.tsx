import { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { filterPhrases, categoryLabel, type PhraseCategory } from "../../data/phrases";
import type { Modality } from "../../types/models";

type Props = {
  modality: Modality;
  onInsert: (text: string) => void;
};

export function QuickInsertPalette({ modality, onInsert }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PhraseCategory | null>(null);

  const filteredPhrases = useMemo(() => {
    let result = filterPhrases(modality);

    if (categoryFilter) {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.text.toLowerCase().includes(q));
    }

    return result;
  }, [modality, search, categoryFilter]);

  const categories: PhraseCategory[] = ["norm", "pathology", "recommendation"];

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Быстрая вставка</p>

      <Input
        placeholder="Поиск фразы..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-xs"
      />

      <div className="flex gap-1">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={categoryFilter === cat ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
          >
            {categoryLabel(cat)}
          </Button>
        ))}
      </div>

      <ScrollArea className="max-h-48">
        <div className="space-y-1">
          {filteredPhrases.map((phrase) => (
            <button
              key={phrase.id}
              onClick={() => onInsert(phrase.text)}
              className="w-full rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
            >
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="shrink-0 text-[9px]">
                  {phrase.section === "description" ? "Описание" : "Заключение"}
                </Badge>
                <span className="line-clamp-2">{phrase.text}</span>
              </div>
            </button>
          ))}
          {filteredPhrases.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Фразы не найдены</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
