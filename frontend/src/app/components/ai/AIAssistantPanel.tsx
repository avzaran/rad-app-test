import { useMemo, useState } from "react";
import {
  Sparkles,
  Send,
  Square,
  Copy,
  Check,
  X,
  ChevronDown,
  Search,
  Database,
} from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useAIStream, useKnowledgeSearch } from "../../hooks/useAI";
import { AIStreamingText } from "./AIStreamingText";
import { type SectionName } from "./AISectionInsert";
import { QuickInsertPalette } from "./QuickInsertPalette";
import { TemplateContextSelector } from "./TemplateContextSelector";
import type { Modality } from "../../types/models";
import type { AISection } from "../../types/ai";

type Props = {
  protocolId: string;
  modality: Modality;
  studyProfile: string;
  knowledgeTags: string[];
  sourceTemplateIds: string[];
  onStudyProfileChange: (value: string) => void;
  onKnowledgeTagsChange: (tags: string[]) => void;
  onSourceTemplateIdsChange: (ids: string[]) => void;
  templateContent: string;
  currentContent: string;
  onInsertFull: (text: string) => void;
  onInsertSection: (sectionName: SectionName, text: string) => void;
  onInsertAtCursor: (text: string) => void;
};

const categoryLabels: Record<string, string> = {
  norm: "Норма",
  pathology: "Патология",
  recommendation: "Рекомендация",
  technique: "Техника",
  other: "Другое",
};

export function AIAssistantPanel({
  protocolId,
  modality,
  studyProfile,
  knowledgeTags,
  sourceTemplateIds,
  onStudyProfileChange,
  onKnowledgeTagsChange,
  onSourceTemplateIdsChange,
  templateContent,
  currentContent,
  onInsertFull,
  onInsertSection,
  onInsertAtCursor,
}: Props) {
  const { text, isStreaming, error, tokensUsed, start, stop, reset } = useAIStream();
  const knowledgeSearch = useKnowledgeSearch();
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const searchVariants = knowledgeSearch.data?.variants ?? [];
  const selectedVariant = useMemo(
    () => searchVariants.find((item) => item.id === selectedVariantId) ?? null,
    [searchVariants, selectedVariantId],
  );

  const generate = (section: AISection) => {
    start({
      modality,
      templateContent,
      section,
      currentContent,
      protocolId,
      studyProfile,
      knowledgeTags,
      sourceTemplateIds,
      ...(sourceTemplateIds.length > 0 ? { uploadedTemplateIds: sourceTemplateIds } : {}),
    });
  };

  const askQuestion = () => {
    if (!question.trim()) return;
    start({
      modality,
      templateContent,
      section: "question",
      currentContent,
      userMessage: question.trim(),
      protocolId,
      studyProfile,
      knowledgeTags,
      sourceTemplateIds,
      ...(sourceTemplateIds.length > 0 ? { uploadedTemplateIds: sourceTemplateIds } : {}),
    });
    setQuestion("");
  };

  const handleKnowledgeSearch = () => {
    if (!knowledgeQuery.trim()) return;
    knowledgeSearch.mutate(
      {
        modality,
        studyProfile,
        query: knowledgeQuery.trim(),
        knowledgeTags,
        sourceTemplateIds,
      },
      {
        onSuccess: (response) => {
          setSelectedVariantId(response.variants[0]?.id ?? null);
        },
      },
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasResult = text.length > 0 && !isStreaming;

  return (
    <div className="flex h-full w-[26rem] flex-col border-l bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI-Ассистент</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <TemplateContextSelector
            modality={modality}
            studyProfile={studyProfile}
            knowledgeTags={knowledgeTags}
            selectedIds={sourceTemplateIds}
            onStudyProfileChange={onStudyProfileChange}
            onKnowledgeTagsChange={onKnowledgeTagsChange}
            onSelectionChange={onSourceTemplateIdsChange}
          />

          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold">Поиск по базе знаний</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={knowledgeQuery}
                onChange={(e) => setKnowledgeQuery(e.target.value)}
                placeholder="Например, мозолистое тело"
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleKnowledgeSearch();
                  }
                }}
              />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                onClick={handleKnowledgeSearch}
                disabled={knowledgeSearch.isPending || !knowledgeQuery.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {knowledgeSearch.error && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
                {knowledgeSearch.error.message}
              </div>
            )}

            {searchVariants.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Варианты формулировки
                  </p>
                  {knowledgeSearch.data?.usedFallback && (
                    <span className="text-[10px] text-muted-foreground">
                      AI fallback без источников
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {searchVariants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        selectedVariantId === variant.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">
                          {categoryLabels[variant.category] ?? variant.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {variant.origin === "db"
                            ? "База знаний"
                            : variant.origin === "ai_from_db"
                              ? "AI + база знаний"
                              : "AI fallback"}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{variant.text}</p>
                      {variant.sources.length > 0 && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Источники:{" "}
                          {variant.sources.map((source) => source.templateName).join(", ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={!selectedVariant}
                  onClick={() => selectedVariant && onInsertAtCursor(selectedVariant.text)}
                >
                  Вставить выбранный вариант
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Быстрые действия</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => generate("description")}
              disabled={isStreaming}
            >
              Сгенерировать описание
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => generate("conclusion")}
              disabled={isStreaming}
            >
              Предложить заключение
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => generate("full")}
              disabled={isStreaming}
            >
              Заполнить протокол
            </Button>
          </div>

          {(text || isStreaming) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Ответ AI</p>
              <AIStreamingText text={text} isStreaming={isStreaming} />

              {isStreaming && (
                <Button variant="destructive" size="sm" className="w-full" onClick={stop}>
                  <Square className="mr-2 h-3 w-3" />
                  Остановить
                </Button>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {hasResult && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onInsertFull(text)}>
                Вставить всё
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    В секцию
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onInsertSection("ТЕХНИКА ИССЛЕДОВАНИЯ", text)}>
                    Техника исследования
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onInsertSection("ОПИСАНИЕ", text)}>
                    Описание
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onInsertSection("ЗАКЛЮЧЕНИЕ", text)}>
                    Заключение
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                {copied ? "Скопировано" : "Копировать"}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="mr-1 h-3 w-3" />
                Отклонить
              </Button>
            </div>
          )}

          {tokensUsed > 0 && !isStreaming && (
            <p className="text-xs text-muted-foreground">Использовано токенов: {tokensUsed}</p>
          )}

          <QuickInsertPalette modality={modality} onInsert={onInsertAtCursor} />

          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Уточните запрос</p>
            <div className="flex gap-2">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Опиши подробнее..."
                rows={2}
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    askQuestion();
                  }
                }}
              />
              <Button
                size="icon"
                variant="outline"
                onClick={askQuestion}
                disabled={isStreaming || !question.trim()}
                className="shrink-0 self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="border-t px-4 py-2">
        <p className="text-[10px] leading-tight text-muted-foreground">
          AI-текст требует обязательной проверки врачом. Результат может содержать неточности.
        </p>
      </div>
    </div>
  );
}
