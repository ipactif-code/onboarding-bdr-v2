"use client";

import { type ReactElement, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Clock, Search, Sparkles, FolderOpen } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSearch } from "@/hooks/knowledge/use-search";

// ============================================================================
// TYPES
// ============================================================================

interface KnowledgeSearchModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * KnowledgeSearchModal - Command palette for Knowledge Base search.
 *
 * Features:
 * - Quick search with real-time results
 * - Recent searches when query is empty
 * - Keyboard navigation (arrow keys, Enter, Esc)
 * - Option to open advanced search page
 *
 * This component is meant to be used alongside the main CommandPalette.
 * It can be triggered from within the main palette or via a separate shortcut.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [open, setOpen] = useState(false);
 *   return <KnowledgeSearchModal open={open} onOpenChange={setOpen} />;
 * }
 * ```
 */
export function KnowledgeSearchModal({
  open,
  onOpenChange,
}: KnowledgeSearchModalProps): ReactElement {
  const router = useRouter();

  const {
    query,
    setQuery,
    quickResults,
    recentSearches,
    isQuickLoading,
  } = useSearch({ debounceMs: 150 });

  // Navigate to document
  const handleSelect = useCallback(
    (documentId: string) => {
      onOpenChange(false);
      setQuery("");
      router.push(`/knowledge/doc/${documentId}`);
    },
    [router, setQuery, onOpenChange]
  );

  // Open advanced search page with current query
  const handleAdvancedSearch = useCallback(() => {
    onOpenChange(false);
    router.push(`/knowledge/search?q=${encodeURIComponent(query)}`);
  }, [router, query, onOpenChange]);

  // Handle modal close - reset query
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        setQuery("");
      }
    },
    [onOpenChange, setQuery]
  );

  // Computed values
  const hasQuery = query.trim().length > 0;
  const showRecent = !hasQuery && recentSearches && recentSearches.length > 0;
  const showResults = hasQuery && quickResults && quickResults.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search Knowledge Base</DialogTitle>
        <DialogDescription>
          Search for documents in the Knowledge Base
        </DialogDescription>
      </DialogHeader>
      <DialogContent
        data-slot="knowledge-search-modal"
        className={cn(
          // Position at top 20% of viewport
          "top-[20%] translate-y-0",
          // Size and appearance
          "sm:max-w-xl p-0 gap-0 overflow-hidden"
        )}
        showCloseButton={false}
      >
        <Command className="rounded-xl" shouldFilter={false}>
          <CommandInput
            placeholder="Search knowledge base..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              {isQuickLoading ? (
                <span className="text-muted-foreground">Searching...</span>
              ) : hasQuery ? (
                <span className="text-muted-foreground">No documents found.</span>
              ) : (
                <span className="text-muted-foreground">
                  Start typing to search...
                </span>
              )}
            </CommandEmpty>

            {/* Recent searches when no query */}
            {showRecent && (
              <CommandGroup heading="Recent Searches">
                {recentSearches.map((search, i) => (
                  <CommandItem
                    key={`recent-${i}`}
                    value={`recent-${search.query}`}
                    onSelect={() => setQuery(search.query)}
                  >
                    <Clock className="size-4 text-muted-foreground" />
                    <span className="truncate">{search.query}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {search.resultCount} results
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Quick results */}
            {showResults && (
              <>
                {showRecent && <CommandSeparator />}
                <CommandGroup heading="Documents">
                  {quickResults.map((doc) => (
                    <CommandItem
                      key={doc._id}
                      value={`doc-${doc._id}`}
                      onSelect={() => handleSelect(doc._id)}
                      className="flex-col items-start gap-1 py-2"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {doc.icon && <span className="mr-1">{doc.icon}</span>}
                          {doc.title}
                        </span>
                      </div>
                      <div className="pl-6 flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderOpen className="size-3" />
                        <span className="truncate">
                          {doc.workspaceName} / {doc.folderName}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Advanced search options */}
            {hasQuery && query.length >= 2 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Actions">
                  <CommandItem
                    value="advanced-search"
                    onSelect={handleAdvancedSearch}
                  >
                    <Search className="size-4 text-muted-foreground" />
                    <span>
                      Search for &quot;{query}&quot; with filters...
                    </span>
                  </CommandItem>
                  <CommandItem
                    value="ai-search"
                    onSelect={() => {
                      onOpenChange(false);
                      router.push(
                        `/knowledge/search?q=${encodeURIComponent(query)}&mode=semantic`
                      );
                    }}
                  >
                    <Sparkles className="size-4 text-muted-foreground" />
                    <span>AI Search for &quot;{query}&quot;</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                esc
              </kbd>
              Close
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>
              Select
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
