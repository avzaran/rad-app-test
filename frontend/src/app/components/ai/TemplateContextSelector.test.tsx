import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemplateContextSelector } from "./TemplateContextSelector";

vi.mock("../../hooks/useUploadedTemplates", () => ({
  useUploadedTemplatesByModalityQuery: () => ({
    data: [
      {
        id: "ut-1",
        fileName: "brain.docx",
        originalName: "МРТ_головного_мозга.docx",
        modality: "MRI",
        studyProfile: "МРТ головного мозга",
        tags: ["без контраста", "стандарт"],
        classificationMode: "manual",
        extractedText: "Мозолистое тело без изменений.",
        fileSize: 10,
        uploadedBy: "u-doctor",
        indexStatus: "ready",
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
}));

describe("TemplateContextSelector", () => {
  it("updates study profile and tag selection", async () => {
    const user = userEvent.setup();
    const onStudyProfileChange = vi.fn();
    const onKnowledgeTagsChange = vi.fn();
    const onSelectionChange = vi.fn();

    render(
      <TemplateContextSelector
        modality="MRI"
        studyProfile="МРТ головного мозга"
        knowledgeTags={[]}
        selectedIds={[]}
        onStudyProfileChange={onStudyProfileChange}
        onKnowledgeTagsChange={onKnowledgeTagsChange}
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /контекст знаний/i }));
    await user.type(screen.getByPlaceholderText(/например, мрт головного мозга/i), " с контрастом");
    await user.click(screen.getByRole("button", { name: "без контраста" }));
    await user.click(screen.getByText("МРТ_головного_мозга.docx"));

    expect(onStudyProfileChange).toHaveBeenCalled();
    expect(onKnowledgeTagsChange).toHaveBeenCalledWith(["без контраста"]);
    expect(onSelectionChange).toHaveBeenCalledWith(["ut-1"]);
  });
});
