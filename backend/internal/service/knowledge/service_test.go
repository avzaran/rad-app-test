package knowledge

import (
	"context"
	"testing"
	"time"

	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository/memory"
	"go.uber.org/zap"
)

func TestBuildContextReturnsDirectAutocompleteFromKnowledge(t *testing.T) {
	repos := memory.NewRepositories()
	svc := NewService(repos.UploadedTemplates, repos.Knowledge, nil, zap.NewNop(), 0)

	template := domain.UploadedTemplate{
		ID:                 "ut-test",
		FileName:           "brain.docx",
		OriginalName:       "brain.docx",
		Modality:           "MRI",
		StudyProfile:       "МРТ головного мозга",
		Tags:               []string{"без контраста"},
		ClassificationMode: domain.TemplateClassificationManual,
		ExtractedText:      "Мозолистое тело без особенностей.",
		FileSize:           100,
		UploadedBy:         "u-doctor",
		IndexStatus:        domain.TemplateIndexStatusReady,
		CreatedAt:          time.Now().UTC(),
	}
	if err := repos.UploadedTemplates.CreateUploadedTemplate(context.Background(), template); err != nil {
		t.Fatalf("CreateUploadedTemplate returned error: %v", err)
	}
	if err := repos.Knowledge.ReplaceTemplateKnowledge(context.Background(), template, []domain.TemplateKnowledgeItem{
		{
			ID:           "ki-1",
			TemplateID:   template.ID,
			UploadedBy:   template.UploadedBy,
			Modality:     template.Modality,
			StudyProfile: template.StudyProfile,
			SearchText:   "мозолистое тело без особенностей обычной толщины и сигнала",
			Content:      "Мозолистое тело без особенностей, обычной толщины и сигнальных характеристик.",
			Section:      "description",
			Category:     domain.KnowledgeCategoryNorm,
			CreatedAt:    time.Now().UTC(),
		},
	}); err != nil {
		t.Fatalf("ReplaceTemplateKnowledge returned error: %v", err)
	}

	result, err := svc.BuildContext(context.Background(), "u-doctor", ContextRequest{
		Section:        "autocomplete",
		Modality:       "MRI",
		StudyProfile:   "МРТ головного мозга",
		CurrentContent: "Мозолистое тело без особенностей",
	})
	if err != nil {
		t.Fatalf("BuildContext returned error: %v", err)
	}
	if result.DirectAutocomplete == "" {
		t.Fatalf("expected direct autocomplete suggestion")
	}
}

func TestSearchReturnsDatabaseVariant(t *testing.T) {
	repos := memory.NewRepositories()
	svc := NewService(repos.UploadedTemplates, repos.Knowledge, nil, zap.NewNop(), 0)

	template := domain.UploadedTemplate{
		ID:                 "ut-search",
		FileName:           "brain.docx",
		OriginalName:       "brain.docx",
		Modality:           "MRI",
		StudyProfile:       "МРТ головного мозга",
		ClassificationMode: domain.TemplateClassificationManual,
		ExtractedText:      "Мозолистое тело без особенностей.",
		FileSize:           100,
		UploadedBy:         "u-doctor",
		IndexStatus:        domain.TemplateIndexStatusReady,
		CreatedAt:          time.Now().UTC(),
	}
	if err := repos.UploadedTemplates.CreateUploadedTemplate(context.Background(), template); err != nil {
		t.Fatalf("CreateUploadedTemplate returned error: %v", err)
	}
	if err := repos.Knowledge.ReplaceTemplateKnowledge(context.Background(), template, []domain.TemplateKnowledgeItem{
		{
			ID:           "ki-search",
			TemplateID:   template.ID,
			UploadedBy:   template.UploadedBy,
			Modality:     template.Modality,
			StudyProfile: template.StudyProfile,
			SearchText:   "мозолистое тело без особенностей",
			Content:      "Мозолистое тело без особенностей, обычной толщины.",
			Section:      "description",
			Category:     domain.KnowledgeCategoryNorm,
			CreatedAt:    time.Now().UTC(),
		},
	}); err != nil {
		t.Fatalf("ReplaceTemplateKnowledge returned error: %v", err)
	}

	resp, err := svc.Search(context.Background(), "u-doctor", SearchRequest{
		Modality:     "MRI",
		StudyProfile: "МРТ головного мозга",
		Query:        "мозолистое тело",
	})
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(resp.Variants) == 0 {
		t.Fatalf("expected at least one variant")
	}
	if resp.Variants[0].Origin != domain.KnowledgeOriginDB {
		t.Fatalf("expected DB origin, got %s", resp.Variants[0].Origin)
	}
}
