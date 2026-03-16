package ai

import (
	"embed"
	"fmt"
	"strings"
)

//go:embed prompts/*.txt
var promptFS embed.FS

// PromptContext holds input for building LLM messages.
type PromptContext struct {
	Modality        string // "CT", "MRI", "X_RAY"
	Section         string // "description", "conclusion", "full", "question"
	TemplateContent string
	CurrentContent  string
	UserMessage     string
}

// Message matches the ai-gateway provider.Message format.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// BuildMessages constructs the message list for the LLM based on context.
func BuildMessages(ctx PromptContext) []Message {
	systemPrompt := loadSystemPrompt(ctx.Modality)

	switch ctx.Section {
	case "description":
		return []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("Напиши описание исследования на основе шаблона:\n\n%s", ctx.TemplateContent)},
		}
	case "conclusion":
		return []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("На основе описания предложи заключение:\n\n%s", ctx.CurrentContent)},
		}
	case "full":
		return []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf("Заполни полный протокол по шаблону:\n\n%s", ctx.TemplateContent)},
		}
	case "question":
		system := systemPrompt + fmt.Sprintf("\n\nТекущий протокол:\n%s", ctx.CurrentContent)
		return []Message{
			{Role: "system", Content: system},
			{Role: "user", Content: ctx.UserMessage},
		}
	default:
		return []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: ctx.UserMessage},
		}
	}
}

// TemperatureForSection returns the recommended temperature for a given section type.
func TemperatureForSection(section string) float64 {
	switch section {
	case "description", "conclusion", "full":
		return 0.3
	default:
		return 0.5
	}
}

// MaxTokensForSection returns the recommended max tokens for a given section type.
func MaxTokensForSection(section string) int {
	switch section {
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
