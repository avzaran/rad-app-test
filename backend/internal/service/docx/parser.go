package docx

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

// ExtractText reads a DOCX file from the given reader and returns the plain text content.
// DOCX files are ZIP archives containing XML files; this function extracts text from word/document.xml.
func ExtractText(reader io.Reader) (string, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("reading docx data: %w", err)
	}

	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("opening docx as zip: %w", err)
	}

	for _, file := range zipReader.File {
		if file.Name == "word/document.xml" {
			rc, err := file.Open()
			if err != nil {
				return "", fmt.Errorf("opening document.xml: %w", err)
			}
			defer rc.Close()

			text, err := extractTextFromXML(rc)
			if err != nil {
				return "", fmt.Errorf("extracting text from document.xml: %w", err)
			}

			return strings.TrimSpace(text), nil
		}
	}

	return "", fmt.Errorf("word/document.xml not found in docx archive")
}

// extractTextFromXML parses the Word XML and extracts all text runs,
// preserving paragraph breaks as newlines.
func extractTextFromXML(r io.Reader) (string, error) {
	decoder := xml.NewDecoder(r)

	var builder strings.Builder
	var inText bool
	var inParagraph bool
	paragraphHasText := false

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}

		switch t := token.(type) {
		case xml.StartElement:
			localName := t.Name.Local
			switch localName {
			case "p":
				if inParagraph && paragraphHasText {
					builder.WriteString("\n")
				}
				inParagraph = true
				paragraphHasText = false
			case "t":
				inText = true
			case "br":
				builder.WriteString("\n")
			case "tab":
				builder.WriteString("\t")
			}
		case xml.EndElement:
			localName := t.Name.Local
			switch localName {
			case "t":
				inText = false
			case "p":
				inParagraph = false
			}
		case xml.CharData:
			if inText {
				text := string(t)
				builder.WriteString(text)
				if text != "" {
					paragraphHasText = true
				}
			}
		}
	}

	return builder.String(), nil
}
