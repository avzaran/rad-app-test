import { useRef, useState, useCallback, type ChangeEvent, type ComponentProps } from "react";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { useAutocomplete } from "../../hooks/useAutocomplete";

type AutocompleteTextareaProps = Omit<ComponentProps<"textarea">, "onChange" | "value"> & {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  modality: string;
  templateContent: string;
  protocolId: string;
  autocompleteEnabled: boolean;
};

/** Shared text styles so the mirror div and textarea render identically. */
const sharedTextClasses = "font-mono text-base leading-relaxed md:text-sm";

export function AutocompleteTextarea({
  value,
  onChange,
  modality,
  templateContent,
  protocolId,
  autocompleteEnabled,
  className,
  ...props
}: AutocompleteTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState(value.length);

  const updateCursor = useCallback(() => {
    const el = textareaRef.current;
    if (el) setCursorPos(el.selectionStart);
  }, []);

  const { suggestion, accept, dismiss } = useAutocomplete({
    content: value,
    cursorPosition: cursorPos,
    modality,
    templateContent,
    protocolId,
    enabled: autocompleteEnabled,
  });

  const textBeforeCursor = value.slice(0, cursorPos);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestion) {
      if (e.key === "Tab") {
        e.preventDefault();
        const newContent = accept();
        const newCursorPos = cursorPos + suggestion.length;
        // Create a synthetic change event via native setter so React picks it up
        const textarea = textareaRef.current;
        if (textarea) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(textarea, newContent);
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          }
          setCursorPos(newCursorPos);
          requestAnimationFrame(() => {
            textarea.selectionStart = newCursorPos;
            textarea.selectionEnd = newCursorPos;
          });
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCursorPos(e.target.selectionStart);
    onChange(e);
  };

  const handleScroll = () => {
    if (textareaRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="relative">
      {/* Mirror div — ghost text overlay. Must match textarea styling exactly. */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words",
          "border border-transparent rounded-md px-3 py-2",
          sharedTextClasses,
        )}
      >
        <span className="invisible">{textBeforeCursor}</span>
        {suggestion && (
          <span className="text-muted-foreground/40 italic">{suggestion}</span>
        )}
      </div>

      {/* Actual textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={updateCursor}
        onClick={updateCursor}
        onScroll={handleScroll}
        className={cn("bg-transparent", sharedTextClasses, className)}
        {...props}
      />
    </div>
  );
}
