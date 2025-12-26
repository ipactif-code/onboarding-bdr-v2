"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface VisibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: Id<"courses">;
  currentVisibility: "all_teams" | "specific_teams" | "specific_users";
  currentTeamIds: Id<"teams">[];
}

export function VisibilityModal({
  open,
  onOpenChange,
  courseId,
  currentVisibility,
  currentTeamIds,
}: VisibilityModalProps) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<Id<"teams">>>(
    new Set(currentTeamIds)
  );
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all teams (skip when modal is closed to avoid auth errors)
  const allTeams = useQuery(api.teams.list, open ? {} : "skip");

  const updateCourse = useMutation(api.courses.update);
  const assignCourse = useMutation(api.courses.assign);
  const unassignCourse = useMutation(api.courses.unassign);

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTeamIds(new Set(currentTeamIds));
    }
  }, [open, currentTeamIds]);

  const handleToggleTeam = (teamId: Id<"teams">) => {
    setSelectedTeamIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const newTeamIds = Array.from(selectedTeamIds);
      const oldTeamIds = currentTeamIds;

      // Determine visibility type
      const newVisibility = newTeamIds.length === 0 ? "all_teams" : "specific_teams";

      // Update course visibility
      await updateCourse({
        courseId,
        visibility: newVisibility,
      });

      // Find teams to add and remove
      const teamsToAdd = newTeamIds.filter((id) => !oldTeamIds.includes(id));
      const teamsToRemove = oldTeamIds.filter((id) => !newTeamIds.includes(id));

      // Add new team assignments
      if (teamsToAdd.length > 0) {
        await assignCourse({ courseId, teamIds: teamsToAdd });
      }

      // Remove old team assignments
      for (const teamId of teamsToRemove) {
        await unassignCourse({ courseId, teamId });
      }

      toast.success("Visibility settings updated");
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast.error("Failed to update visibility settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Course Visibility</DialogTitle>
          <DialogDescription>
            Select which teams can access this course. If no teams are selected,
            the course will be visible to all teams.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] py-4">
          {allTeams === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : allTeams.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              No teams available
            </p>
          ) : (
            <div className="space-y-2">
              {allTeams.map((team: { _id: Id<"teams">; name: string }) => {
                const isSelected = selectedTeamIds.has(team._id);
                return (
                  <div
                    key={team._id}
                    onClick={() => handleToggleTeam(team._id)}
                    className={`
                      flex cursor-pointer items-center justify-between rounded-lg border p-3
                      transition-colors hover:bg-muted/50
                      ${isSelected ? "border-primary bg-primary/5" : "border-border"}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleTeam(team._id)}
                      />
                      <span className="font-medium">{team.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="rounded-lg bg-muted/50 p-3 text-sm text-gray-600">
          {selectedTeamIds.size === 0 ? (
            <span>This course will be visible to <strong>all teams</strong></span>
          ) : (
            <span>
              This course will be visible to{" "}
              <strong>{selectedTeamIds.size} team(s)</strong>
            </span>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
