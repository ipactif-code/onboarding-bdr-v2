"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

interface CourseFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export function CourseFilters({
  open,
  onOpenChange,
  selectedTag,
  onTagChange,
}: CourseFiltersProps) {
  // Fetch tags for filter options
  const tags = useQuery(api.tags.list, {});

  const handleClear = () => {
    onTagChange(null);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 gap-2">
          <SlidersHorizontal className="size-4" />
          Filter
          {selectedTag && (
            <Badge variant="secondary" className="ml-1 rounded-full px-1.5">
              1
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {selectedTag && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-neutral-500"
                onClick={handleClear}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Tag Filter */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Tag</Label>
            <RadioGroup
              value={selectedTag || ""}
              onValueChange={(value) =>
                onTagChange(value === "" ? null : value)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="" id="all" />
                <Label htmlFor="all" className="text-sm font-normal">
                  All tags
                </Label>
              </div>
              {tags?.map((tag) => (
                <div key={tag._id} className="flex items-center space-x-2">
                  <RadioGroupItem value={tag._id} id={tag._id} />
                  <Label htmlFor={tag._id} className="text-sm font-normal">
                    {tag.name}
                    <span className="text-neutral-400 ml-1">
                      ({tag.courseCount})
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
