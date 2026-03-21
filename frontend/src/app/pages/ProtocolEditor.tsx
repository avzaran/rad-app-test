import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { Save, CheckCircle2, Sparkles, X, FileText } from "lucide-react";
import { useProtocolQuery, useUpdateProtocolMutation } from "../hooks/useProtocols";
import { useProtocolTabsStore } from "../store/protocolTabsStore";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { AIAssistantPanel } from "../components/ai/AIAssistantPanel";
import { AutocompleteTextarea } from "../components/ai/AutocompleteTextarea";
import { replaceSection, type SectionName } from "../components/ai/AISectionInsert";
import { env } from "../lib/env";
import { toast } from "sonner";

export function ProtocolEditor() {
  const navigate = useNavigate();
  const { protocolId } = useParams();

  const { data: protocol, isLoading } = useProtocolQuery(protocolId);
  const updateProtocol = useUpdateProtocolMutation();
  const openProtocol = useProtocolTabsStore((state) => state.openProtocol);

  const [content, setContent] = useState("");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [templateHintDismissed, setTemplateHintDismissed] = useState(false);
  const [knowledgeStudyProfile, setKnowledgeStudyProfile] = useState("");
  const [knowledgeTags, setKnowledgeTags] = useState<string[]>([]);
  const [knowledgeTemplateIds, setKnowledgeTemplateIds] = useState<string[]>([]);
  const templateHintShownRef = useRef(false);

  useEffect(() => {
    if (protocol) {
      setContent(protocol.content);
      setKnowledgeStudyProfile(protocol.template?.name ?? "");
      setKnowledgeTags([]);
      setKnowledgeTemplateIds([]);
      openProtocol({
        id: protocol.id,
        patient: protocol.patient,
      });
    }
  }, [openProtocol, protocol]);

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Загрузка протокола...</div>;
  }

  if (!protocol) {
    return (
      <div className="p-8">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Протокол не найден</h1>
          <Button className="mt-4" onClick={() => navigate("/protocols")}>Назад к протоколам</Button>
        </Card>
      </div>
    );
  }

  const onSaveDraft = async () => {
    await updateProtocol.mutateAsync({
      id: protocol.id,
      patch: {
        content,
        status: "draft",
      },
    });
    toast.success("Черновик сохранен");
  };

  const onComplete = async () => {
    await updateProtocol.mutateAsync({
      id: protocol.id,
      patch: {
        content,
        status: "completed",
      },
    });
    toast.success("Протокол завершен");
  };

  const handleInsertFull = (text: string) => {
    setContent(text);
    toast.success("Текст вставлен. Пожалуйста, проверьте перед сохранением.");
  };

  const handleInsertSection = (sectionName: SectionName, text: string) => {
    setContent((prev) => replaceSection(prev, sectionName, text));
    toast.success(`Секция «${sectionName}» обновлена. Проверьте перед сохранением.`);
  };

  const handleInsertAtCursor = (text: string) => {
    setContent((prev) => prev + (prev.endsWith("\n") || prev === "" ? "" : "\n") + text);
    toast.success("Фраза вставлена");
  };

  const modalityLabel =
    protocol.modality === "CT" ? "КТ" : protocol.modality === "MRI" ? "МРТ" : "Рентген";

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main editor area */}
      <div className="flex-1 space-y-6 overflow-y-auto p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{protocol.patient.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {modalityLabel}
              {protocol.template ? ` • ${protocol.template.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {env.aiEnabled && (
              <Button
                variant={aiPanelOpen ? "default" : "outline"}
                onClick={() => setAiPanelOpen(!aiPanelOpen)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI
              </Button>
            )}
            <Button variant="outline" onClick={onSaveDraft} disabled={updateProtocol.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Сохранить черновик
            </Button>
            <Button onClick={onComplete} disabled={updateProtocol.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Завершить
            </Button>
          </div>
        </div>

        <Card className="p-6">
          {aiPanelOpen &&
            env.aiEnabled &&
            !templateHintDismissed &&
            !templateHintShownRef.current && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <p className="flex-1 text-xs text-primary">
                  AI может предложить текст на основе загруженных шаблонов
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-primary/60 transition-colors hover:text-primary"
                  onClick={() => {
                    setTemplateHintDismissed(true);
                    templateHintShownRef.current = true;
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          <AutocompleteTextarea
            value={content}
            onValueChange={setContent}
            rows={20}
            modality={protocol.modality}
            studyProfile={knowledgeStudyProfile}
            knowledgeTags={knowledgeTags}
            sourceTemplateIds={knowledgeTemplateIds}
            templateContent={protocol.template?.content ?? ""}
            protocolId={protocol.id}
            autocompleteEnabled={env.aiEnabled && !aiPanelOpen}
          />
        </Card>
      </div>

      {/* AI Panel */}
      {aiPanelOpen && env.aiEnabled && (
        <AIAssistantPanel
          protocolId={protocol.id}
          modality={protocol.modality}
          studyProfile={knowledgeStudyProfile}
          knowledgeTags={knowledgeTags}
          sourceTemplateIds={knowledgeTemplateIds}
          onStudyProfileChange={setKnowledgeStudyProfile}
          onKnowledgeTagsChange={setKnowledgeTags}
          onSourceTemplateIdsChange={setKnowledgeTemplateIds}
          templateContent={protocol.template?.content ?? ""}
          currentContent={content}
          onInsertFull={handleInsertFull}
          onInsertSection={handleInsertSection}
          onInsertAtCursor={handleInsertAtCursor}
        />
      )}
    </div>
  );
}
