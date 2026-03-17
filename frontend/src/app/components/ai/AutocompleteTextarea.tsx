import { useRef, useCallback, type ChangeEvent, type ComponentProps } from "react";
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
  const cursorRef = useRef(value.length);

  const trackCursor = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      cursorRef.current = el.selectionStart;
    }
  }, []);

  const { suggestion, accept, dismiss } = useAutocomplete({
    content: value,
    cursorPosition: cursorRef.current,
    modality,
    templateContent,
    protocolId,
    enabled: autocompleteEnabled,
  });

  const textBeforeCursor = value.slice(0, cursorRef.current);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestion) {
      if (e.key === "Tab") {
        e.preventDefault();
        const newContent = accept();
        // Create a synthetic-like event by updating via native setter
        const textarea = textareaRef.current;
        if (textarea) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(textarea, newContent);
            const event = new Event("input", { bubbles: true });
            textarea.dispatchEvent(event);
          }
          // Move cursor to end of inserted suggestion
          const newCursorPos = cursorRef.current + suggestion.length;
          requestAnimationFrame(() => {
            textarea.selectionStart = newCursorPos;
            textarea.selectionEnd = newCursorPos;
            cursorRef.current = newCursorPos;
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
    cursorRef.current = e.target.selectionStart;
    onChange(e);
  };

  const handleScroll = () => {
    if (textareaRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="relative">
      {/* Mirror div — ghost text overlay */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-mono text-sm px-3 py-2"
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
        onSelect={trackCursor}
        onClick={trackCursor}
        onScroll={handleScroll}
        className={cn("bg-transparent font-mono text-sm", className)}
        {...props}
      />
    </div>
  );
}
