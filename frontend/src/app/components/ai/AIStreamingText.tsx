import { useEffect, useRef } from "react";

type Props = {
  text: string;
  isStreaming: boolean;
};

export function AIStreamingText({ text, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  if (!text && !isStreaming) return null;

  return (
    <div
      ref={containerRef}
      className="max-h-80 overflow-y-auto rounded-md border bg-muted/50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
    >
      {text.split(/\n/).map((line, i) => {
        const isSection = /^(ТЕХНИКА|ОПИСАНИЕ|ЗАКЛЮЧЕНИЕ)/.test(line);
        return (
          <span key={i}>
            {i > 0 && "\n"}
            {isSection ? <strong>{line}</strong> : line}
          </span>
        );
      })}
      {isStreaming && <span className="animate-pulse">▍</span>}
    </div>
  );
}
