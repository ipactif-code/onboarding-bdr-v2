"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamsTable } from "@/components/admin/teams/teams-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function TeamsList() {
  const [search, setSearch] = useState("");
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch teams
  const teams = useQuery(api.teams.list, {
    search: search || undefined,
  });

  // Mutations
  const createTeam = useMutation(api.teams.create);
  const removeTeam = useMutation(api.teams.remove);

  // Create team handler
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    setIsCreating(true);
    try {
      await createTeam({
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || undefined,
      });
      setNewTeamName("");
      setNewTeamDescription("");
      setNewTeamOpen(false);
      toast.success("Team created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create team");
    } finally {
      setIsCreating(false);
    }
  };

  // Delete team handler
  const handleDeleteTeam = async (teamId: Id<"teams">) => {
    try {
      await removeTeam({ teamId });
      toast.success("Team deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete team");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">Teams</h1>
        <Dialog open={newTeamOpen} onOpenChange={setNewTeamOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
              <DialogDescription>
                Create a new team to organize your users.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Sales Team"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-description">Description (optional)</Label>
                <Textarea
                  id="team-description"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="What is this team about?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewTeamOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={isCreating || !newTeamName.trim()}
              >
                {isCreating ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative w-[373px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {teams === undefined ? (
        <TeamsTableSkeleton />
      ) : (
        <TeamsTable teams={teams} onDelete={handleDeleteTeam} />
      )}
    </div>
  );
}

function TeamsTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
