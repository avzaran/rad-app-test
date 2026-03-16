const SECTION_REGEX = /^(ТЕХНИКА ИССЛЕДОВАНИЯ:|ОПИСАНИЕ:|ЗАКЛЮЧЕНИЕ:)/m;

export type SectionName = "ТЕХНИКА ИССЛЕДОВАНИЯ" | "ОПИСАНИЕ" | "ЗАКЛЮЧЕНИЕ";

type Section = {
  name: SectionName;
  startIndex: number;
  endIndex: number;
};

/** Parse protocol text into named sections. */
export function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  let currentSection: Section | null = null;
  let charIndex = 0;

  for (const line of lines) {
    const match = line.match(SECTION_REGEX);
    if (match) {
      if (currentSection) {
        currentSection.endIndex = charIndex;
        sections.push(currentSection);
      }
      currentSection = {
        name: match[1].replace(":", "") as SectionName,
        startIndex: charIndex,
        endIndex: text.length,
      };
    }
    charIndex += line.length + 1; // +1 for \n
  }

  if (currentSection) {
    currentSection.endIndex = text.length;
    sections.push(currentSection);
  }

  return sections;
}

/** Replace the content of a specific section, keeping other sections intact. */
export function replaceSection(fullText: string, sectionName: SectionName, newContent: string): string {
  const normalizedText = fullText.replace(/\r\n/g, "\n");
  const sections = parseSections(normalizedText);
  const target = sections.find((s) => s.name === sectionName);

  if (!target) {
    // Section not found — append at end
    return fullText + `\n\n${sectionName}:\n${newContent}`;
  }

  const before = normalizedText.slice(0, target.startIndex);
  const after = normalizedText.slice(target.endIndex);
  return before + `${sectionName}:\n${newContent}` + after;
}
