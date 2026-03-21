package ai

import (
	"strings"
	"testing"
)

func TestBuildMessagesForAutocompleteIncludesCursorContext(t *testing.T) {
	messages := BuildMessages(PromptContext{
		Modality:       "CT",
		Section:        "autocomplete",
		CurrentContent: "Широкий контекст слева",
		PrefixText:     "Левая часть предложения",
		SuffixText:     "Правая часть предложения.",
	})

	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}

	if !strings.Contains(messages[0].Content, "Не повторяй текст, который уже стоит справа от курсора") {
		t.Fatalf("expected autocomplete system prompt to mention right-side deduplication, got %q", messages[0].Content)
	}

	if !strings.Contains(messages[1].Content, "ШИРОКИЙ ЛЕВЫЙ КОНТЕКСТ:\nШирокий контекст слева") {
		t.Fatalf("expected autocomplete user prompt to include broad left context, got %q", messages[1].Content)
	}

	if !strings.Contains(messages[1].Content, "ТЕКСТ СЛЕВА ОТ КУРСОРА В ТЕКУЩЕМ ПРЕДЛОЖЕНИИ:\nЛевая часть предложения") {
		t.Fatalf("expected autocomplete user prompt to include prefix text, got %q", messages[1].Content)
	}

	if !strings.Contains(messages[1].Content, "ТЕКСТ СПРАВА ОТ КУРСОРА В ТЕКУЩЕМ ПРЕДЛОЖЕНИИ:\nПравая часть предложения.") {
		t.Fatalf("expected autocomplete user prompt to include suffix text, got %q", messages[1].Content)
	}
}

func TestBuildMessagesForAutocompleteAllowsEmptySuffix(t *testing.T) {
	messages := BuildMessages(PromptContext{
		Modality:       "MRI",
		Section:        "autocomplete",
		CurrentContent: "Контекст в конце документа",
		PrefixText:     "Текст перед курсором",
	})

	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}

	if !strings.Contains(messages[1].Content, "ТЕКСТ СПРАВА ОТ КУРСОРА В ТЕКУЩЕМ ПРЕДЛОЖЕНИИ:\n(пусто)") {
		t.Fatalf("expected empty suffix placeholder in autocomplete prompt, got %q", messages[1].Content)
	}

	if !strings.Contains(messages[1].Content, "ТЕКСТ СЛЕВА ОТ КУРСОРА В ТЕКУЩЕМ ПРЕДЛОЖЕНИИ:\nТекст перед курсором") {
		t.Fatalf("expected prefix text to remain available for end-of-document autocomplete, got %q", messages[1].Content)
	}
}

func TestBuildMessagesIncludesStudyProfileAndKnowledgeContext(t *testing.T) {
	messages := BuildMessages(PromptContext{
		Modality:         "CT",
		Section:          "description",
		StudyProfile:     "КТ органов грудной клетки",
		TemplateContent:  "Шаблон",
		KnowledgeContext: "Справочный контекст",
	})

	if len(messages) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(messages))
	}

	if !strings.Contains(messages[0].Content, "Текущий профиль исследования: КТ органов грудной клетки.") {
		t.Fatalf("expected system prompt to include study profile, got %q", messages[0].Content)
	}

	if messages[1].Content != "Справочный контекст" {
		t.Fatalf("expected knowledge context to be inserted as second message, got %q", messages[1].Content)
	}
}
