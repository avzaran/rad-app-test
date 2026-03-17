import {
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type UIEvent,
  type SyntheticEvent,
} from "react";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { useAutocomplete } from "../../hooks/useAutocomplete";

type AutocompleteTextareaProps = Omit<ComponentProps<"textarea">, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
  modality: string;
  templateContent: string;
  protocolId: string;
  autocompleteEnabled: boolean;
};

const sharedTextClasses = "font-mono text-base leading-relaxed md:text-sm";

export function AutocompleteTextarea({
  value,
  onValueChange,
  modality,
  templateContent,
  protocolId,
  autocompleteEnabled,
  className,
  onKeyDown,
  onKeyDownCapture,
  onSelect,
  onClick,
  onScroll,
  ...props
}: AutocompleteTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const [cursorPos, setCursorPos] = useState(value.length);

  const updateCursor = useCallback(() => {
    const el = textareaRef.current;
    if (el) setCursorPos(el.selectionStart);
  }, []);

  useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    const textarea = textareaRef.current;
    if (pendingSelection === null || !textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(pendingSelection, pendingSelection);
    pendingSelectionRef.current = null;
  }, [value]);

  const { suggestion, accept, dismiss } = useAutocomplete({
    content: value,
    cursorPosition: cursorPos,
    modality,
    templateContent,
    protocolId,
    enabled: autocompleteEnabled,
  });

  const textBeforeCursor = value.slice(0, cursorPos);

  const handleAutocompleteKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!suggestion) {
        return false;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        
        const newContent = accept();
        const newCursorPos = cursorPos + suggestion.length;
        pendingSelectionRef.current = newCursorPos;
        setCursorPos(newCursorPos);
        onValueChange(newContent);
        return true;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
        return true;
      }

      return false;
    },
    [accept, cursorPos, dismiss, onValueChange, suggestion],
  );

  const handleKeyDownCapture = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleAutocompleteKey(e)) {
      return;
    }
    onKeyDownCapture?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.defaultPrevented) {
      handleAutocompleteKey(e);
    }
    if (!e.defaultPrevented) {
      onKeyDown?.(e);
    }
  };

  const handleChange = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    setCursorPos(target.selectionStart);
    onValueChange(target.value);
  };

  const syncScroll = useCallback(() => {
    if (textareaRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handleSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    updateCursor();
    onSelect?.(e);
  };

  const handleClick = (e: MouseEvent<HTMLTextAreaElement>) => {
    updateCursor();
    onClick?.(e);
  };

  const handleScrollEvent = (e: UIEvent<HTMLTextAreaElement>) => {
    syncScroll();
    onScroll?.(e);
  };

  return (
    <div className="relative">
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

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDownCapture={handleKeyDownCapture}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onClick={handleClick}
        onScroll={handleScrollEvent}
        className={cn("bg-transparent", sharedTextClasses, className)}
        {...props}
      />
    </div>
  );
}
