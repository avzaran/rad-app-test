import {
  useRef,
  useState,
  useCallback,
  useEffect,
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
const POPUP_MAX_WIDTH = 400;
const POPUP_GUTTER = 8;
const POPUP_GAP = 8;

type PopupPosition = {
  left: number;
  top: number;
  maxWidth: number;
  placement: "top" | "bottom";
};

function isAtLineEnd(content: string, cursorPosition: number): boolean {
  return cursorPosition === content.length || content[cursorPosition] === "\n";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const caretMarkerRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const [cursorPos, setCursorPos] = useState(value.length);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);

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

  const { suggestion, overlapText, status, totalTokensUsed, accept, dismiss } = useAutocomplete({
    content: value,
    cursorPosition: cursorPos,
    modality,
    templateContent,
    protocolId,
    enabled: autocompleteEnabled,
  });

  const textBeforeCursor = value.slice(0, cursorPos);
  const endOfLineMode = isAtLineEnd(value, cursorPos);
  const showLoadingIndicator = status === "debouncing" || status === "loading";
  const showHint = Boolean(suggestion);
  const showGhostPreview = Boolean(suggestion) && endOfLineMode;
  const showPopup = Boolean(suggestion) && !endOfLineMode;

  const updatePopupPosition = useCallback(() => {
    if (!showPopup) {
      setPopupPosition(null);
      return;
    }

    const textarea = textareaRef.current;
    const wrapper = wrapperRef.current;
    const popup = popupRef.current;
    const marker = caretMarkerRef.current;
    if (!textarea || !wrapper || !popup || !marker) {
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const wrapperWidth = wrapper.clientWidth || wrapperRect.width || 400;
    const wrapperHeight = wrapper.clientHeight || wrapperRect.height || 320;
    const popupWidth = popupRect.width || 220;
    const popupHeight = popupRect.height || 48;
    const computedStyle = window.getComputedStyle(textarea);
    const fontSize = Number.parseFloat(computedStyle.fontSize) || 16;
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || fontSize * 1.5;
    const caretLeft = marker.offsetLeft;
    const caretTop = marker.offsetTop - textarea.scrollTop;
    const maxWidth = Math.min(POPUP_MAX_WIDTH, Math.max(180, wrapperWidth - POPUP_GUTTER * 2));
    const shouldShowAbove =
      caretTop + lineHeight + POPUP_GAP + popupHeight > wrapperHeight - POPUP_GUTTER &&
      caretTop - POPUP_GAP >= popupHeight;
    const rawTop = shouldShowAbove
      ? caretTop - popupHeight - POPUP_GAP
      : caretTop + lineHeight + POPUP_GAP;
    const maxLeft = Math.max(POPUP_GUTTER, wrapperWidth - popupWidth - POPUP_GUTTER);
    const maxTop = Math.max(POPUP_GUTTER, wrapperHeight - popupHeight - POPUP_GUTTER);

    setPopupPosition({
      left: clamp(caretLeft, POPUP_GUTTER, maxLeft),
      top: clamp(rawTop, POPUP_GUTTER, maxTop),
      maxWidth,
      placement: shouldShowAbove ? "top" : "bottom",
    });
  }, [showPopup]);

  const handleAutocompleteKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        if (!suggestion) {
          return false;
        }

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
        if (!suggestion && status !== "debouncing" && status !== "loading") {
          return false;
        }

        e.preventDefault();
        e.stopPropagation();
        dismiss();
        return true;
      }

      return false;
    },
    [accept, cursorPos, dismiss, onValueChange, status, suggestion],
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
    updatePopupPosition();
    onScroll?.(e);
  };

  useLayoutEffect(() => {
    if (!showPopup) {
      setPopupPosition(null);
      return;
    }

    updatePopupPosition();
  }, [cursorPos, showPopup, suggestion, overlapText, updatePopupPosition, value]);

  useEffect(() => {
    if (!showPopup) {
      return;
    }

    const wrapper = wrapperRef.current;
    const textarea = textareaRef.current;
    if (!wrapper || !textarea) {
      return;
    }

    const handleWindowResize = () => {
      updatePopupPosition();
    };

    window.addEventListener("resize", handleWindowResize);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.removeEventListener("resize", handleWindowResize);
      };
    }

    const observer = new ResizeObserver(() => {
      updatePopupPosition();
    });

    observer.observe(wrapper);
    observer.observe(textarea);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [showPopup, updatePopupPosition]);

  return (
    <div>
      <div ref={wrapperRef} className="relative overflow-hidden rounded-md">
        {(showLoadingIndicator || showHint) && (
          <div className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-2 rounded-md border border-border/60 bg-background/85 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {showLoadingIndicator && (
              <div
                role="status"
                aria-label="Автокомплит загружается"
                className="flex h-4 w-4 items-center justify-center"
              >
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {showHint && <span className="whitespace-nowrap">Tab - принять, Esc - скрыть</span>}
          </div>
        )}

        <div
          ref={mirrorRef}
          data-testid="autocomplete-ghost"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words",
            "border border-transparent rounded-md px-3 py-2",
            sharedTextClasses,
          )}
        >
          {showGhostPreview && (
            <>
              <span className="invisible">{textBeforeCursor}</span>
              <span className="text-muted-foreground/40 italic">{suggestion}</span>
            </>
          )}
        </div>

        {showPopup && (
          <>
            <div
              ref={measureRef}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words opacity-0",
                "border border-transparent rounded-md px-3 py-2",
                sharedTextClasses,
              )}
            >
              <span>{textBeforeCursor}</span>
              <span ref={caretMarkerRef}>{"\u200b"}</span>
            </div>

            <div
              ref={popupRef}
              data-testid="autocomplete-popup"
              data-placement={popupPosition?.placement ?? "bottom"}
              className="pointer-events-none absolute z-20 rounded-md border border-border/70 bg-background/95 px-2 py-1.5 text-xs shadow-lg backdrop-blur"
              style={{
                left: popupPosition?.left ?? POPUP_GUTTER,
                top: popupPosition?.top ?? POPUP_GUTTER,
                maxWidth: popupPosition?.maxWidth ?? POPUP_MAX_WIDTH,
                visibility: popupPosition ? "visible" : "hidden",
              }}
            >
              <div
                className="whitespace-pre-wrap break-words leading-5"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                <span className="rounded-sm bg-emerald-500/12 px-1 py-0.5 text-emerald-700 dark:text-emerald-300">
                  {suggestion}
                </span>
                {overlapText && (
                  <span className="rounded-sm bg-rose-500/12 px-1 py-0.5 text-rose-700 dark:text-rose-300">
                    {overlapText}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDownCapture={handleKeyDownCapture}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onClick={handleClick}
          onScroll={handleScrollEvent}
          className={cn("relative z-10 bg-transparent field-sizing-fixed", sharedTextClasses, className)}
          {...props}
        />
      </div>

      <div className="min-h-4 pt-1 text-left">
        {totalTokensUsed > 0 && (
          <div className="pointer-events-none pl-1 text-[10px] text-muted-foreground/60">
            {totalTokensUsed} ток.
          </div>
        )}
      </div>
    </div>
  );
}
