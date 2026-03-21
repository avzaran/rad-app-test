package knowledge

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository"
	"github.com/radassist/backend/internal/service/ai"
	"go.uber.org/zap"
)

const (
	defaultWorkerPoll  = 1500 * time.Millisecond
	defaultSearchLimit = 8
)

var whitespaceRE = regexp.MustCompile(`\s+`)

type AIClient interface {
	GenerateWithMessages(ctx context.Context, userID, auditAction string, messages []ai.Message, temperature float64, maxTokens int) (*ai.GenerateResponse, error)
}

type ContextRequest struct {
	Section           string
	Modality          string
	StudyProfile      string
	Query             string
	CurrentContent    string
	KnowledgeTags     []string
	SourceTemplateIDs []string
}

type ContextResult struct {
	Items              []domain.TemplateKnowledgeItem
	KnowledgeContext   string
	DirectAutocomplete string
}

type CreateIndexJobRequest struct {
	Modality          string   `json:"modality"`
	StudyProfile      string   `json:"studyProfile"`
	SourceTemplateIDs []string `json:"sourceTemplateIds"`
}

type SearchRequest struct {
	Modality          string   `json:"modality"`
	StudyProfile      string   `json:"studyProfile"`
	Query             string   `json:"query"`
	KnowledgeTags     []string `json:"knowledgeTags"`
	SourceTemplateIDs []string `json:"sourceTemplateIds"`
}

type Service struct {
	templates  repository.UploadedTemplateRepository
	knowledge  repository.KnowledgeRepository
	aiClient   AIClient
	logger     *zap.Logger
	workerPoll time.Duration
}

func NewService(
	templates repository.UploadedTemplateRepository,
	knowledge repository.KnowledgeRepository,
	aiClient AIClient,
	logger *zap.Logger,
	workerPoll time.Duration,
) *Service {
	if logger == nil {
		logger = zap.NewNop()
	}
	if workerPoll <= 0 {
		workerPoll = defaultWorkerPoll
	}
	return &Service{
		templates:  templates,
		knowledge:  knowledge,
		aiClient:   aiClient,
		logger:     logger,
		workerPoll: workerPoll,
	}
}

func (s *Service) RunWorker(ctx context.Context) {
	if s.templates == nil || s.knowledge == nil {
		return
	}

	ticker := time.NewTicker(s.workerPoll)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		job, err := s.knowledge.ClaimPendingIndexJob(ctx)
		if err != nil {
			s.logger.Warn("claim knowledge job failed", zap.Error(err))
			continue
		}
		if job == nil {
			continue
		}

		if err := s.processJob(ctx, job); err != nil {
			s.logger.Warn("process knowledge job failed", zap.String("job_id", job.ID), zap.Error(err))
		}
	}
}

func (s *Service) CreateIndexJob(ctx context.Context, userID string, req CreateIndexJobRequest) (*domain.TemplateIndexJob, error) {
	filter := domain.UploadedTemplateFilter{
		Modality:          req.Modality,
		StudyProfile:      req.StudyProfile,
		SourceTemplateIDs: req.SourceTemplateIDs,
	}
	templates, err := s.templates.FindUploadedTemplates(ctx, userID, filter)
	if err != nil {
		return nil, fmt.Errorf("find templates for index job: %w", err)
	}
	if len(templates) == 0 {
		return nil, fmt.Errorf("no uploaded templates available for indexing")
	}

	sourceIDs := make([]string, 0, len(templates))
	for _, template := range templates {
		sourceIDs = append(sourceIDs, template.ID)
		template.IndexStatus = domain.TemplateIndexStatusPending
		template.LastIndexError = ""
		template.LastIndexedAt = nil
		if err := s.templates.UpdateUploadedTemplate(ctx, template); err != nil {
			return nil, fmt.Errorf("mark template %s as pending: %w", template.ID, err)
		}
	}

	job := domain.TemplateIndexJob{
		ID:                 uuid.NewString(),
		CreatedBy:          userID,
		Modality:           req.Modality,
		StudyProfile:       req.StudyProfile,
		SourceTemplateIDs:  sourceIDs,
		Status:             domain.TemplateIndexJobPending,
		TotalTemplates:     len(sourceIDs),
		ProcessedTemplates: 0,
		CreatedAt:          time.Now().UTC(),
	}
	if err := s.knowledge.CreateIndexJob(ctx, job); err != nil {
		return nil, fmt.Errorf("create index job: %w", err)
	}

	return &job, nil
}

func (s *Service) GetIndexJob(ctx context.Context, userID, jobID string) (*domain.TemplateIndexJob, error) {
	return s.knowledge.GetIndexJob(ctx, jobID, userID)
}

func (s *Service) BuildContext(ctx context.Context, userID string, req ContextRequest) (*ContextResult, error) {
	query := strings.TrimSpace(req.Query)
	if query == "" {
		switch req.Section {
		case "autocomplete":
			query = extractAutocompleteQuery(req.CurrentContent)
		case "question":
			query = req.Query
		case "conclusion":
			query = extractConclusionQuery(req.CurrentContent)
		default:
			query = extractTopicQuery(req.CurrentContent)
		}
	}

	items, err := s.knowledge.SearchKnowledge(ctx, domain.KnowledgeSearchParams{
		UserID:            userID,
		Modality:          req.Modality,
		StudyProfile:      req.StudyProfile,
		Query:             query,
		Tags:              req.KnowledgeTags,
		SourceTemplateIDs: req.SourceTemplateIDs,
		Limit:             defaultSearchLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("search knowledge for ai context: %w", err)
	}

	result := &ContextResult{
		Items:            items,
		KnowledgeContext: BuildKnowledgeContext(items),
	}

	if req.Section == "autocomplete" {
		result.DirectAutocomplete = tryDirectAutocomplete(req.CurrentContent, items)
	}

	return result, nil
}

func (s *Service) Search(ctx context.Context, userID string, req SearchRequest) (*domain.KnowledgeSearchResponse, error) {
	items, err := s.knowledge.SearchKnowledge(ctx, domain.KnowledgeSearchParams{
		UserID:            userID,
		Modality:          req.Modality,
		StudyProfile:      req.StudyProfile,
		Query:             strings.TrimSpace(req.Query),
		Tags:              req.KnowledgeTags,
		SourceTemplateIDs: req.SourceTemplateIDs,
		Limit:             defaultSearchLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("search knowledge: %w", err)
	}

	response := &domain.KnowledgeSearchResponse{
		Query: strings.TrimSpace(req.Query),
	}
	if len(items) > 0 {
		variants, err := s.buildDBVariants(ctx, userID, items)
		if err != nil {
			return nil, err
		}
		if aiVariants := s.buildAISupplementVariants(ctx, userID, req, items); len(aiVariants) > 0 {
			variants = append(variants, aiVariants...)
		}
		sort.SliceStable(variants, func(i, j int) bool {
			return variantRank(variants[i].Category) < variantRank(variants[j].Category)
		})
		response.Variants = variants
		return response, nil
	}

	response.UsedFallback = true
	response.Variants = s.buildFallbackVariants(ctx, userID, req)
	return response, nil
}

func BuildKnowledgeContext(items []domain.TemplateKnowledgeItem) string {
	if len(items) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("=== КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ ===\n")
	sb.WriteString("Используй только как персонализированный источник терминологии, структуры и типовых формулировок.\n\n")

	for i, item := range items {
		sb.WriteString(fmt.Sprintf("%d. [%s/%s] %s\n", i+1, item.Section, item.Category, strings.TrimSpace(item.Content)))
	}

	sb.WriteString("\n=== КОНЕЦ КОНТЕКСТА ===")
	return sb.String()
}

func (s *Service) processJob(ctx context.Context, job *domain.TemplateIndexJob) error {
	templates, err := s.templates.FindUploadedTemplates(ctx, job.CreatedBy, domain.UploadedTemplateFilter{
		Modality:          job.Modality,
		StudyProfile:      job.StudyProfile,
		SourceTemplateIDs: job.SourceTemplateIDs,
	})
	if err != nil {
		job.Status = domain.TemplateIndexJobFailed
		job.LastError = err.Error()
		now := time.Now().UTC()
		job.FinishedAt = &now
		job.LastHeartbeatAt = &now
		_ = s.knowledge.UpdateIndexJob(ctx, *job)
		return fmt.Errorf("load templates for job: %w", err)
	}

	var failed bool
	for _, template := range templates {
		now := time.Now().UTC()
		template.IndexStatus = domain.TemplateIndexStatusRunning
		template.LastIndexError = ""
		if err := s.templates.UpdateUploadedTemplate(ctx, template); err != nil {
			s.logger.Warn("update template running status failed", zap.String("template_id", template.ID), zap.Error(err))
		}

		items, err := s.extractKnowledgeItems(ctx, job.CreatedBy, template)
		if err != nil {
			failed = true
			template.IndexStatus = domain.TemplateIndexStatusFailed
			template.LastIndexError = err.Error()
			if updErr := s.templates.UpdateUploadedTemplate(ctx, template); updErr != nil {
				s.logger.Warn("update template failure status failed", zap.String("template_id", template.ID), zap.Error(updErr))
			}
			if job.LastError == "" {
				job.LastError = err.Error()
			}
		} else {
			if err := s.knowledge.ReplaceTemplateKnowledge(ctx, template, items); err != nil {
				failed = true
				template.IndexStatus = domain.TemplateIndexStatusFailed
				template.LastIndexError = err.Error()
				if updErr := s.templates.UpdateUploadedTemplate(ctx, template); updErr != nil {
					s.logger.Warn("update template replace failure failed", zap.String("template_id", template.ID), zap.Error(updErr))
				}
				if job.LastError == "" {
					job.LastError = err.Error()
				}
			} else {
				template.IndexStatus = domain.TemplateIndexStatusReady
				template.LastIndexedAt = &now
				template.LastIndexError = ""
				if updErr := s.templates.UpdateUploadedTemplate(ctx, template); updErr != nil {
					s.logger.Warn("update template ready status failed", zap.String("template_id", template.ID), zap.Error(updErr))
				}
			}
		}

		job.ProcessedTemplates++
		job.LastHeartbeatAt = &now
		if err := s.knowledge.UpdateIndexJob(ctx, *job); err != nil {
			s.logger.Warn("update knowledge job progress failed", zap.String("job_id", job.ID), zap.Error(err))
		}
	}

	now := time.Now().UTC()
	if failed {
		job.Status = domain.TemplateIndexJobFailed
	} else {
		job.Status = domain.TemplateIndexJobCompleted
	}
	job.FinishedAt = &now
	job.LastHeartbeatAt = &now
	if err := s.knowledge.UpdateIndexJob(ctx, *job); err != nil {
		return fmt.Errorf("finalize knowledge job: %w", err)
	}

	return nil
}

func (s *Service) extractKnowledgeItems(ctx context.Context, userID string, template domain.UploadedTemplate) ([]domain.TemplateKnowledgeItem, error) {
	sanitized := ai.SanitizePII(template.ExtractedText)
	items := heuristicKnowledgeItems(template, sanitized)

	if s.aiClient == nil {
		return items, nil
	}

	structured, err := s.extractKnowledgeItemsWithAI(ctx, userID, template, sanitized)
	if err != nil || len(structured) == 0 {
		if err != nil {
			s.logger.Info("knowledge ai extraction fallback", zap.String("template_id", template.ID), zap.Error(err))
		}
		return items, nil
	}

	return structured, nil
}

func (s *Service) extractKnowledgeItemsWithAI(ctx context.Context, userID string, template domain.UploadedTemplate, sanitized string) ([]domain.TemplateKnowledgeItem, error) {
	messages := []ai.Message{
		{
			Role:    "system",
			Content: "Ты структурируешь радиологические шаблоны в JSON. Верни только JSON-массив объектов с полями: section, category, content, anatomyTerms, pathologyTerms. category должен быть одним из norm,pathology,recommendation,technique,other. Не добавляй пояснений.",
		},
		{
			Role:    "user",
			Content: fmt.Sprintf("Модальность: %s\nПрофиль: %s\n\nТекст шаблона:\n%s", template.Modality, template.StudyProfile, sanitized),
		},
	}

	resp, err := s.aiClient.GenerateWithMessages(ctx, userID, "knowledge_extract", messages, 0.1, 1800)
	if err != nil {
		return nil, err
	}

	type itemPayload struct {
		Section        string   `json:"section"`
		Category       string   `json:"category"`
		Content        string   `json:"content"`
		AnatomyTerms   []string `json:"anatomyTerms"`
		PathologyTerms []string `json:"pathologyTerms"`
	}

	raw := extractJSONArray(resp.Text)
	if raw == "" {
		return nil, fmt.Errorf("ai extraction did not return json array")
	}

	var payload []itemPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, fmt.Errorf("decode ai extraction json: %w", err)
	}

	items := make([]domain.TemplateKnowledgeItem, 0, len(payload))
	now := time.Now().UTC()
	for idx, entry := range payload {
		content := strings.TrimSpace(entry.Content)
		if content == "" {
			continue
		}
		items = append(items, domain.TemplateKnowledgeItem{
			ID:             uuid.NewString(),
			TemplateID:     template.ID,
			UploadedBy:     template.UploadedBy,
			Modality:       template.Modality,
			StudyProfile:   template.StudyProfile,
			Tags:           append([]string(nil), template.Tags...),
			Section:        normalizeSection(entry.Section),
			Category:       normalizeCategory(entry.Category),
			AnatomyTerms:   normalizeTerms(entry.AnatomyTerms),
			PathologyTerms: normalizeTerms(entry.PathologyTerms),
			SearchText:     buildSearchText(content, entry.AnatomyTerms, entry.PathologyTerms),
			Content:        content,
			SortOrder:      idx,
			Metadata: map[string]string{
				"source": "ai",
			},
			CreatedAt: now,
		})
	}

	return items, nil
}

func heuristicKnowledgeItems(template domain.UploadedTemplate, text string) []domain.TemplateKnowledgeItem {
	sections := splitSections(text)
	now := time.Now().UTC()
	var items []domain.TemplateKnowledgeItem
	sortOrder := 0

	for section, paragraphs := range sections {
		for _, paragraph := range paragraphs {
			content := normalizeWhitespace(paragraph)
			if content == "" {
				continue
			}
			items = append(items, domain.TemplateKnowledgeItem{
				ID:             uuid.NewString(),
				TemplateID:     template.ID,
				UploadedBy:     template.UploadedBy,
				Modality:       template.Modality,
				StudyProfile:   template.StudyProfile,
				Tags:           append([]string(nil), template.Tags...),
				Section:        section,
				Category:       detectCategory(section, content),
				AnatomyTerms:   guessAnatomyTerms(content),
				PathologyTerms: guessPathologyTerms(content),
				SearchText:     buildSearchText(content, guessAnatomyTerms(content), guessPathologyTerms(content)),
				Content:        content,
				SortOrder:      sortOrder,
				Metadata: map[string]string{
					"source": "heuristic",
				},
				CreatedAt: now,
			})
			sortOrder++
		}
	}

	return items
}

func splitSections(text string) map[string][]string {
	lines := strings.Split(text, "\n")
	result := map[string][]string{
		"technique":   {},
		"description": {},
		"conclusion":  {},
	}

	currentSection := "description"
	var currentParagraph strings.Builder
	flush := func() {
		paragraph := strings.TrimSpace(currentParagraph.String())
		if paragraph != "" {
			result[currentSection] = append(result[currentSection], paragraph)
		}
		currentParagraph.Reset()
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		upper := strings.ToUpper(trimmed)
		switch {
		case strings.Contains(upper, "ТЕХНИКА"):
			flush()
			currentSection = "technique"
			continue
		case strings.Contains(upper, "ОПИСАНИЕ"):
			flush()
			currentSection = "description"
			continue
		case strings.Contains(upper, "ЗАКЛЮЧЕНИЕ"):
			flush()
			currentSection = "conclusion"
			continue
		}

		if trimmed == "" {
			flush()
			continue
		}
		if currentParagraph.Len() > 0 {
			currentParagraph.WriteString(" ")
		}
		currentParagraph.WriteString(trimmed)
	}
	flush()

	return result
}

func detectCategory(section, content string) domain.KnowledgeItemCategory {
	lower := strings.ToLower(content)
	switch {
	case section == "technique":
		return domain.KnowledgeCategoryTechnique
	case section == "conclusion" && strings.Contains(lower, "рекоменд"):
		return domain.KnowledgeCategoryRecommendation
	case strings.Contains(lower, "без патолог") || strings.Contains(lower, "не выявлено") || strings.Contains(lower, "норма"):
		return domain.KnowledgeCategoryNorm
	case strings.Contains(lower, "рекоменд"):
		return domain.KnowledgeCategoryRecommendation
	case strings.Contains(lower, "очаг") || strings.Contains(lower, "изменен") || strings.Contains(lower, "патолог") || strings.Contains(lower, "кист") || strings.Contains(lower, "опух") || strings.Contains(lower, "атроф") || strings.Contains(lower, "грыж") || strings.Contains(lower, "инфильтр") || strings.Contains(lower, "отек"):
		return domain.KnowledgeCategoryPathology
	default:
		return domain.KnowledgeCategoryOther
	}
}

func guessAnatomyTerms(content string) []string {
	terms := []string{
		"мозолистое тело", "головной мозг", "желудочковая система", "срединные структуры", "базальные цистерны",
		"легкие", "средостение", "плевра", "печень", "почки", "позвоночник", "спинной мозг", "гипофиз",
	}
	return matchKnownTerms(content, terms)
}

func guessPathologyTerms(content string) []string {
	terms := []string{
		"очаг", "атрофия", "киста", "опухоль", "отек", "инфильтрация", "гидроцефалия", "демиелинизация",
		"грыжа", "стеноз", "кровоизлияние", "ишемия",
	}
	return matchKnownTerms(content, terms)
}

func matchKnownTerms(content string, candidates []string) []string {
	lower := strings.ToLower(content)
	var result []string
	for _, candidate := range candidates {
		if strings.Contains(lower, candidate) {
			result = append(result, candidate)
		}
	}
	return result
}

func buildSearchText(content string, anatomyTerms, pathologyTerms []string) string {
	parts := []string{content}
	parts = append(parts, anatomyTerms...)
	parts = append(parts, pathologyTerms...)
	return normalizeWhitespace(strings.Join(parts, " "))
}

func tryDirectAutocomplete(currentContent string, items []domain.TemplateKnowledgeItem) string {
	tail := normalizeWhitespace(lastLine(currentContent))
	if len([]rune(tail)) < 12 {
		return ""
	}

	lowerTail := strings.ToLower(tail)
	for _, item := range items {
		lowerContent := strings.ToLower(item.Content)
		idx := strings.Index(lowerContent, lowerTail)
		if idx < 0 {
			continue
		}
		remainder := strings.TrimSpace(item.Content[idx+len(tail):])
		if remainder == "" {
			continue
		}
		if sentence := firstSentence(remainder); sentence != "" {
			return sentence
		}
	}

	return ""
}

func extractAutocompleteQuery(content string) string {
	line := normalizeWhitespace(lastLine(content))
	if line != "" {
		return line
	}
	return extractTopicQuery(content)
}

func extractConclusionQuery(content string) string {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return ""
	}
	parts := strings.Split(trimmed, "\n")
	if len(parts) == 0 {
		return ""
	}
	last := normalizeWhitespace(parts[len(parts)-1])
	if last != "" {
		return last
	}
	return extractTopicQuery(content)
}

func extractTopicQuery(content string) string {
	words := strings.Fields(normalizeWhitespace(content))
	if len(words) == 0 {
		return ""
	}
	if len(words) > 12 {
		words = words[len(words)-12:]
	}
	return strings.Join(words, " ")
}

func lastLine(content string) string {
	trimmed := strings.TrimRight(content, "\n")
	if trimmed == "" {
		return ""
	}
	lines := strings.Split(trimmed, "\n")
	return lines[len(lines)-1]
}

func firstSentence(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	for _, sep := range []string{".", "!", "?"} {
		if idx := strings.Index(text, sep); idx >= 0 {
			return strings.TrimSpace(text[:idx+1])
		}
	}
	return text
}

func normalizeWhitespace(text string) string {
	return strings.TrimSpace(whitespaceRE.ReplaceAllString(text, " "))
}

func normalizeTerms(terms []string) []string {
	result := make([]string, 0, len(terms))
	seen := map[string]struct{}{}
	for _, term := range terms {
		normalized := normalizeWhitespace(term)
		if normalized == "" {
			continue
		}
		key := strings.ToLower(normalized)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func normalizeSection(section string) string {
	switch strings.ToLower(strings.TrimSpace(section)) {
	case "technique", "техника":
		return "technique"
	case "conclusion", "заключение":
		return "conclusion"
	default:
		return "description"
	}
}

func normalizeCategory(category string) domain.KnowledgeItemCategory {
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "norm":
		return domain.KnowledgeCategoryNorm
	case "pathology":
		return domain.KnowledgeCategoryPathology
	case "recommendation":
		return domain.KnowledgeCategoryRecommendation
	case "technique":
		return domain.KnowledgeCategoryTechnique
	default:
		return domain.KnowledgeCategoryOther
	}
}

func (s *Service) buildDBVariants(ctx context.Context, userID string, items []domain.TemplateKnowledgeItem) ([]domain.KnowledgeVariant, error) {
	sourceIDs := make([]string, 0, len(items))
	seenSourceIDs := map[string]struct{}{}
	for _, item := range items {
		if _, ok := seenSourceIDs[item.TemplateID]; ok {
			continue
		}
		seenSourceIDs[item.TemplateID] = struct{}{}
		sourceIDs = append(sourceIDs, item.TemplateID)
	}

	templates, err := s.templates.FindUploadedTemplates(ctx, userID, domain.UploadedTemplateFilter{
		SourceTemplateIDs: sourceIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("load templates for search variants: %w", err)
	}

	templateNames := make(map[string]string, len(templates))
	for _, template := range templates {
		templateNames[template.ID] = template.OriginalName
	}

	var variants []domain.KnowledgeVariant
	seenTexts := map[string]struct{}{}
	for _, item := range items {
		key := strings.ToLower(item.Content)
		if _, ok := seenTexts[key]; ok {
			continue
		}
		seenTexts[key] = struct{}{}
		variants = append(variants, domain.KnowledgeVariant{
			ID:       item.ID,
			Category: item.Category,
			Text:     item.Content,
			Origin:   domain.KnowledgeOriginDB,
			Sources: []domain.KnowledgeSource{
				{
					TemplateID:   item.TemplateID,
					TemplateName: templateNames[item.TemplateID],
					Section:      item.Section,
					Category:     item.Category,
				},
			},
		})
		if len(variants) == defaultSearchLimit {
			break
		}
	}

	sort.SliceStable(variants, func(i, j int) bool {
		return variantRank(variants[i].Category) < variantRank(variants[j].Category)
	})

	return variants, nil
}

func (s *Service) buildFallbackVariants(ctx context.Context, userID string, req SearchRequest) []domain.KnowledgeVariant {
	if s.aiClient == nil || strings.TrimSpace(req.Query) == "" {
		return nil
	}

	messages := []ai.Message{
		{
			Role:    "system",
			Content: "Ты помогаешь радиологу формулировать фразы для протокола. Верни только JSON-массив максимум из трех объектов с полями category и text. category должен быть одним из norm,pathology,recommendation.",
		},
		{
			Role:    "user",
			Content: fmt.Sprintf("Модальность: %s\nПрофиль: %s\nЗапрос: %s", req.Modality, req.StudyProfile, req.Query),
		},
	}

	resp, err := s.aiClient.GenerateWithMessages(ctx, userID, "knowledge_search_fallback", messages, 0.2, 800)
	if err != nil {
		s.logger.Info("knowledge fallback generation failed", zap.Error(err))
		return nil
	}

	type variantPayload struct {
		Category string `json:"category"`
		Text     string `json:"text"`
	}

	raw := extractJSONArray(resp.Text)
	if raw == "" {
		return nil
	}

	var payload []variantPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		s.logger.Info("knowledge fallback decode failed", zap.Error(err))
		return nil
	}

	var variants []domain.KnowledgeVariant
	for _, entry := range payload {
		text := strings.TrimSpace(entry.Text)
		if text == "" {
			continue
		}
		variants = append(variants, domain.KnowledgeVariant{
			ID:       uuid.NewString(),
			Category: normalizeCategory(entry.Category),
			Text:     text,
			Origin:   domain.KnowledgeOriginAIFallback,
			Sources:  nil,
		})
	}

	sort.SliceStable(variants, func(i, j int) bool {
		return variantRank(variants[i].Category) < variantRank(variants[j].Category)
	})

	return variants
}

func (s *Service) buildAISupplementVariants(
	ctx context.Context,
	userID string,
	req SearchRequest,
	items []domain.TemplateKnowledgeItem,
) []domain.KnowledgeVariant {
	if s.aiClient == nil || strings.TrimSpace(req.Query) == "" || len(items) == 0 {
		return nil
	}

	var snippets []string
	for i, item := range items {
		if i == 4 {
			break
		}
		snippets = append(snippets, item.Content)
	}

	messages := []ai.Message{
		{
			Role:    "system",
			Content: "Ты помогаешь радиологу кратко нормализовать найденные в базе знаний варианты. Верни только JSON-массив максимум из двух объектов с полями category и text. category должен быть одним из norm,pathology,recommendation.",
		},
		{
			Role: "user",
			Content: fmt.Sprintf(
				"Модальность: %s\nПрофиль: %s\nЗапрос: %s\n\nФрагменты из базы знаний:\n- %s",
				req.Modality,
				req.StudyProfile,
				req.Query,
				strings.Join(snippets, "\n- "),
			),
		},
	}

	resp, err := s.aiClient.GenerateWithMessages(ctx, userID, "knowledge_search_enrich", messages, 0.2, 700)
	if err != nil {
		s.logger.Info("knowledge enrich generation failed", zap.Error(err))
		return nil
	}

	type variantPayload struct {
		Category string `json:"category"`
		Text     string `json:"text"`
	}

	raw := extractJSONArray(resp.Text)
	if raw == "" {
		return nil
	}

	var payload []variantPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		s.logger.Info("knowledge enrich decode failed", zap.Error(err))
		return nil
	}

	var variants []domain.KnowledgeVariant
	for _, entry := range payload {
		text := strings.TrimSpace(entry.Text)
		if text == "" {
			continue
		}
		variants = append(variants, domain.KnowledgeVariant{
			ID:       uuid.NewString(),
			Category: normalizeCategory(entry.Category),
			Text:     text,
			Origin:   domain.KnowledgeOriginAIFromDB,
			Sources:  nil,
		})
	}

	sort.SliceStable(variants, func(i, j int) bool {
		return variantRank(variants[i].Category) < variantRank(variants[j].Category)
	})

	return variants
}

func variantRank(category domain.KnowledgeItemCategory) int {
	switch category {
	case domain.KnowledgeCategoryNorm:
		return 0
	case domain.KnowledgeCategoryPathology:
		return 1
	case domain.KnowledgeCategoryRecommendation:
		return 2
	case domain.KnowledgeCategoryTechnique:
		return 3
	default:
		return 4
	}
}

func extractJSONArray(text string) string {
	start := strings.Index(text, "[")
	end := strings.LastIndex(text, "]")
	if start < 0 || end < start {
		return ""
	}
	return text[start : end+1]
}
