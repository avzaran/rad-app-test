package ai

import (
	"embed"
	"fmt"
	"strings"

	"github.com/radassist/backend/internal/domain"
)

//go:embed prompts/*.txt
var promptFS embed.FS

// PromptContext holds input for building LLM messages.
type PromptContext struct {
	Modality        string // "CT", "MRI", "X_RAY"
	Section         string // "description", "conclusion", "full", "question", "autocomplete"
	TemplateContent string
	CurrentContent  string
	PrefixText      string
	SuffixText      string
	UserMessage     string
	TemplateContext string // formatted reference templates context
}

// Message matches the ai-gateway provider.Message format.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// BuildMessages constructs the message list for the LLM based on context.
func BuildMessages(ctx PromptContext) []Message {
	systemPrompt := loadSystemPrompt(ctx.Modality)

	var messages []Message

	switch ctx.Section {
	case "description":
		messages = []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("Напиши описание исследования на основе шаблона:\n\n%s", ctx.TemplateContent)},
		}
	case "conclusion":
		messages = []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("На основе описания предложи заключение:\n\n%s", ctx.CurrentContent)},
		}
	case "full":
		messages = []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("Заполни полный протокол по шаблону:\n\n%s", ctx.TemplateContent)},
		}
	case "autocomplete":
		directive := "ЗАДАЧА: Продолжи текст протокола с места, где остановился врач.\n\n" +
			"ПРАВИЛА:\n" +
			"- Продолжай текст ТОЧНО в позиции курсора, а не только в конце документа\n" +
			"- Предложи ТОЛЬКО продолжение, НЕ повторяй уже написанный текст\n" +
			"- Не повторяй текст, который уже стоит справа от курсора\n" +
			"- Предложи 1-2 предложения (краткое дополнение)\n" +
			"- Сохраняй стиль и терминологию\n" +
			"- Не добавляй переводы строк в начале ответа\n" +
			"- Отвечай ТОЛЬКО текстом продолжения, без пояснений"
		messages = []Message{
			{Role: "system", Content: systemPrompt + "\n\n" + directive},
			{Role: "user", Content: buildAutocompletePrompt(ctx)},
		}
	case "question":
		system := systemPrompt + fmt.Sprintf("\n\nТекущий протокол:\n%s", ctx.CurrentContent)
		messages = []Message{
			{Role: "system", Content: system},
			{Role: "user", Content: ctx.UserMessage},
		}
	default:
		messages = []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: ctx.UserMessage},
		}
	}

	// Insert template context between system prompt and user prompt
	if ctx.TemplateContext != "" {
		templateMsg := Message{Role: "system", Content: ctx.TemplateContext}
		// Insert after the first system message
		result := make([]Message, 0, len(messages)+1)
		result = append(result, messages[0])
		result = append(result, templateMsg)
		result = append(result, messages[1:]...)
		messages = result
	}

	return messages
}

func buildAutocompletePrompt(ctx PromptContext) string {
	var sb strings.Builder

	sb.WriteString("ШИРОКИЙ ЛЕВЫЙ КОНТЕКСТ:\n")
	if strings.TrimSpace(ctx.CurrentContent) == "" {
		sb.WriteString("(пусто)")
	} else {
		sb.WriteString(ctx.CurrentContent)
	}

	sb.WriteString("\n\nТЕКСТ СЛЕВА ОТ КУРСОРА В ТЕКУЩЕМ ПРЕДЛОЖЕНИИ:\n")
	if strings.TrimSpace(ctx.PrefixText) == "" {
		sb.WriteString("(пусто)")
	} else {
		sb.WriteString(ctx.PrefixText)
	}

	sb.WriteString("\n\nТЕКСТ СПРАВА ОТ КУРСОРА В ТЕКУЩЕМ ПРЕДЛОЖЕНИИ:\n")
	if strings.TrimSpace(ctx.SuffixText) == "" {
		sb.WriteString("(пусто)")
	} else {
		sb.WriteString(ctx.SuffixText)
	}

	sb.WriteString("\n\nПродолжи текст ровно в точке курсора. Если справа уже есть готовое продолжение, не повторяй его.")

	return sb.String()
}

// maxTemplateContextLen is the maximum total character length for all template context.
const maxTemplateContextLen = 4000

// BuildTemplateContext formats uploaded templates as reference context for the LLM.
// It limits total output to ~4000 characters, truncating each template proportionally.
func BuildTemplateContext(templates []domain.UploadedTemplate) string {
	if len(templates) == 0 {
		return ""
	}

	// Filter out templates with empty extracted text
	var valid []domain.UploadedTemplate
	for _, t := range templates {
		if strings.TrimSpace(t.ExtractedText) != "" {
			valid = append(valid, t)
		}
	}
	if len(valid) == 0 {
		return ""
	}

	// Calculate total text length to decide on truncation
	totalLen := 0
	for _, t := range valid {
		totalLen += len(t.ExtractedText)
	}

	// Determine max chars per template (proportional truncation)
	// Reserve some chars for headers/footers (~100 chars per template for formatting)
	headerOverhead := len(valid) * 100
	availableChars := maxTemplateContextLen - headerOverhead
	if availableChars < 200 {
		availableChars = 200
	}

	var sb strings.Builder
	sb.WriteString("=== СПРАВОЧНЫЕ ШАБЛОНЫ ===\n")
	sb.WriteString("Ниже представлены загруженные шаблоны протоколов, используйте их как образец стиля, структуры и терминологии при написании нового протокола.\n\n")

	for _, t := range valid {
		// Calculate proportional budget for this template
		var budget int
		if totalLen > availableChars {
			budget = int(float64(len(t.ExtractedText)) / float64(totalLen) * float64(availableChars))
			if budget < 100 {
				budget = 100
			}
		} else {
			budget = len(t.ExtractedText)
		}

		text := t.ExtractedText
		if len(text) > budget {
			text = text[:budget] + "..."
		}

		sb.WriteString(fmt.Sprintf("--- Шаблон: %s ---\n", t.OriginalName))
		sb.WriteString(text)
		sb.WriteString("\n--- Конец шаблона ---\n\n")
	}

	sb.WriteString("=== КОНЕЦ СПРАВОЧНЫХ ШАБЛОНОВ ===")

	return sb.String()
}

// TemperatureForSection returns the recommended temperature for a given section type.
func TemperatureForSection(section string) float64 {
	switch section {
	case "description", "conclusion", "full":
		return 0.3
	case "autocomplete":
		return 0.2
	default:
		return 0.5
	}
}

// MaxTokensForSection returns the recommended max tokens for a given section type.
func MaxTokensForSection(section string) int {
	switch section {
	case "autocomplete":
		return 100
	case "conclusion":
		return 500
	case "question":
		return 1000
	default:
		return 2000
	}
}

func loadSystemPrompt(modality string) string {
	base := readPromptFile("prompts/system_base.txt")

	var modalityFile string
	switch strings.ToUpper(modality) {
	case "CT":
		modalityFile = "prompts/system_ct.txt"
	case "MRI":
		modalityFile = "prompts/system_mri.txt"
	case "X_RAY":
		modalityFile = "prompts/system_xray.txt"
	}

	if modalityFile != "" {
		modalityPrompt := readPromptFile(modalityFile)
		if modalityPrompt != "" {
			return base + "\n\n" + modalityPrompt
		}
	}

	return base
}

func readPromptFile(name string) string {
	data, err := promptFS.ReadFile(name)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}
