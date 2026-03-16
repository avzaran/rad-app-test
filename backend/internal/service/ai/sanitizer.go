package ai

import "regexp"

var (
	// Russian full names: Иванов Иван Иванович
	reFullName = regexp.MustCompile(`[А-ЯЁ][а-яё]{1,20}\s+[А-ЯЁ][а-яё]{1,20}\s+[А-ЯЁ][а-яё]{1,20}`)

	// Phone numbers: +7 (999) 123-45-67, 89991234567, etc.
	rePhone = regexp.MustCompile(`\+?[78]\s?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}`)

	// Email addresses
	reEmail = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)

	// Dates in common formats: 01.01.1990, 01/01/1990
	reDate = regexp.MustCompile(`\d{2}[./]\d{2}[./]\d{4}`)
)

// SanitizePII replaces personally identifiable information with placeholders.
func SanitizePII(text string) string {
	text = reFullName.ReplaceAllString(text, "[ПАЦИЕНТ]")
	text = rePhone.ReplaceAllString(text, "[ТЕЛЕФОН]")
	text = reEmail.ReplaceAllString(text, "[EMAIL]")
	text = reDate.ReplaceAllString(text, "[ДАТА]")
	return text
}
