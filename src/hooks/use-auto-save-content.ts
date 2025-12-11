import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface UseAutoSaveContentOptions<T> {
  initialContent?: T[];
  debounceMs?: number;
  onSave: (content: T[]) => Promise<void>;
}

interface UseAutoSaveContentReturn<T> {
  content: T[];
  setContent: (content: T[]) => void;
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
}

export function useAutoSaveContent<T = unknown>({
  initialContent = [],
  debounceMs = 1500,
  onSave,
}: UseAutoSaveContentOptions<T>): UseAutoSaveContentReturn<T> {
  const [content, setContent] = useState<T[]>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const isFirstRender = useRef(true);

  const debouncedContent = useDebounce(content, debounceMs);

  // Auto-save when debounced content changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const saveContent = async () => {
      setIsSaving(true);
      setError(null);
      try {
        await onSave(debouncedContent);
        setLastSaved(new Date());
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Save failed"));
        console.error("Auto-save error:", err);
      } finally {
        setIsSaving(false);
      }
    };

    saveContent();
  }, [debouncedContent, onSave]);

  return {
    content,
    setContent,
    isSaving,
    lastSaved,
    error,
  };
}
