"use client";

import { type ReactElement } from "react";
import { useQuery } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
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
}: CourseFiltersProps): ReactElement {
  // Fetch tags for filter options
  const tags = useQuery(api.tags.list, {});

  const handleClear = (): void => {
    onTagChange(null);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<Button variant="outline" className="h-10 gap-2" />}>
        <SlidersHorizontal className="size-4" />
        Filter
        {selectedTag && (
          <Badge variant="secondary" className="ml-1 rounded-full px-1.5">
            1
          </Badge>
        )}
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
                className="h-auto p-0 text-xs text-muted-foreground"
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
                onTagChange(value === "" ? null : value as string)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="" id="all" />
                <Label htmlFor="all" className="text-sm font-normal">
                  All tags
                </Label>
              </div>
              {tags?.map((tag: { _id: string; name: string; courseCount: number }) => (
                <div key={tag._id} className="flex items-center space-x-2">
                  <RadioGroupItem value={tag._id} id={tag._id} />
                  <Label htmlFor={tag._id} className="text-sm font-normal">
                    {tag.name}
                    <span className="text-muted-foreground ml-1">
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
