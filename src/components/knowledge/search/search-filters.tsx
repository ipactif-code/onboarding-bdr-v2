"use client";

import { type ReactElement, useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SearchFilters as SearchFiltersType } from "@/hooks/knowledge/use-search";

// ============================================================================
// TYPES
// ============================================================================

interface SearchFiltersProps {
  /** Current filter values */
  filters: SearchFiltersType;
  /** Callback when filters change */
  onChange: (filters: SearchFiltersType) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * SearchFilters - Filter controls for Knowledge Base search.
 *
 * Features:
 * - Status filter (published/draft)
 * - Date range picker (start and end dates)
 * - Clear all filters button
 *
 * Note: Workspace and creator filters could be added in the future
 * when the corresponding data is available.
 *
 * @example
 * ```tsx
 * function SearchPage() {
 *   const { filters, setFilters } = useSearch();
 *   return <SearchFilters filters={filters} onChange={setFilters} />;
 * }
 * ```
 */
export function SearchFilters({
  filters,
  onChange,
}: SearchFiltersProps): ReactElement {
  // Date picker open state
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Check if any filters are active
  const hasFilters = !!(
    filters.workspaceIds?.length ||
    filters.creatorIds?.length ||
    filters.dateRange?.start ||
    filters.dateRange?.end ||
    filters.status
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    onChange({});
  }, [onChange]);

  // Toggle status filter
  const toggleStatus = useCallback(
    (status: "published" | "draft") => {
      onChange({
        ...filters,
        status: filters.status === status ? undefined : status,
      });
    },
    [filters, onChange]
  );

  // Update date range
  const updateDateRange = useCallback(
    (field: "start" | "end", date: Date | undefined) => {
      onChange({
        ...filters,
        dateRange: {
          ...filters.dateRange,
          [field]: date?.getTime(),
        },
      });
    },
    [filters, onChange]
  );

  // Clear date range
  const clearDateRange = useCallback(() => {
    onChange({
      ...filters,
      dateRange: undefined,
    });
  }, [filters, onChange]);

  return (
    <div className="space-y-6" data-slot="search-filters">
      {/* Header with clear button */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Filters</h3>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 px-2 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {/* Status filter */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Status</Label>
        <div className="flex gap-2">
          <Button
            variant={filters.status === "published" ? "default" : "outline"}
            size="sm"
            onClick={() => toggleStatus("published")}
            className="flex-1"
          >
            Published
          </Button>
          <Button
            variant={filters.status === "draft" ? "default" : "outline"}
            size="sm"
            onClick={() => toggleStatus("draft")}
            className="flex-1"
          >
            Draft
          </Button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Date Range</Label>
          {(filters.dateRange?.start || filters.dateRange?.end) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDateRange}
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {/* Start date */}
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateRange?.start && "text-muted-foreground"
                  )}
                />
              }
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.start
                ? format(filters.dateRange.start, "PPP")
                : "Start date"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={
                  filters.dateRange?.start
                    ? new Date(filters.dateRange.start)
                    : undefined
                }
                onSelect={(date) => {
                  updateDateRange("start", date);
                  setStartDateOpen(false);
                }}
                disabled={(date) =>
                  filters.dateRange?.end
                    ? date > new Date(filters.dateRange.end)
                    : date > new Date()
                }
              />
            </PopoverContent>
          </Popover>

          {/* End date */}
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateRange?.end && "text-muted-foreground"
                  )}
                />
              }
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.end
                ? format(filters.dateRange.end, "PPP")
                : "End date"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={
                  filters.dateRange?.end
                    ? new Date(filters.dateRange.end)
                    : undefined
                }
                onSelect={(date) => {
                  updateDateRange("end", date);
                  setEndDateOpen(false);
                }}
                disabled={(date) =>
                  filters.dateRange?.start
                    ? date < new Date(filters.dateRange.start)
                    : false
                }
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
