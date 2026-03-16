import { useState } from "react";
import { Sparkles, Send, Square, Copy, Check, X, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useAIStream } from "../../hooks/useAI";
import { AIStreamingText } from "./AIStreamingText";
import { type SectionName } from "./AISectionInsert";
import { QuickInsertPalette } from "./QuickInsertPalette";
import type { Modality } from "../../types/models";
import type { AISection } from "../../types/ai";

type Props = {
  protocolId: string;
  modality: Modality;
  templateContent: string;
  currentContent: string;
  onInsertFull: (text: string) => void;
  onInsertSection: (sectionName: SectionName, text: string) => void;
  onInsertAtCursor: (text: string) => void;
};

export function AIAssistantPanel({
  protocolId,
  modality,
  templateContent,
  currentContent,
  onInsertFull,
  onInsertSection,
  onInsertAtCursor,
}: Props) {
  const { text, isStreaming, error, tokensUsed, start, stop, reset } = useAIStream();
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = (section: AISection) => {
    start({
      modality,
      templateContent,
      section,
      currentContent,
      protocolId,
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
    });
    setQuestion("");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasResult = text.length > 0 && !isStreaming;

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI-Ассистент</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {/* Quick actions */}
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

          {/* Streaming output */}
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

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Action buttons */}
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

          {/* Tokens used */}
          {tokensUsed > 0 && !isStreaming && (
            <p className="text-xs text-muted-foreground">Использовано токенов: {tokensUsed}</p>
          )}

          {/* Quick insert phrases */}
          <QuickInsertPalette modality={modality} onInsert={onInsertAtCursor} />

          {/* Question input */}
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

      {/* Disclaimer */}
      <div className="border-t px-4 py-2">
        <p className="text-[10px] leading-tight text-muted-foreground">
          AI-текст требует обязательной проверки врачом. Результат может содержать неточности.
        </p>
      </div>
    </div>
  );
}
