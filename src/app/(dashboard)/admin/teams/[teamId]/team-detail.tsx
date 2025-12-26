"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import Link from "next/link";
import { ArrowLeft, Pencil, Users, BookOpen, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MembersTable } from "@/components/admin/teams/members-table";
import { AddMemberDialog } from "@/components/admin/teams/add-member-dialog";
import { toast } from "sonner";

interface TeamDetailProps {
  teamId: Id<"teams">;
}

export function TeamDetail({ teamId }: TeamDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch team details
  const team = useQuery(api.teams.get, { teamId });
  const members = useQuery(api.teams.getMembers, { teamId });

  // Mutations
  const updateTeam = useMutation(api.teams.update);
  const removeMember = useMutation(api.teams.removeMember);
  const setLead = useMutation(api.teams.setLead);

  // Start editing
  const handleStartEdit = () => {
    if (team) {
      setEditName(team.name);
      setEditDescription(team.description || "");
      setIsEditing(true);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName("");
    setEditDescription("");
  };

  // Save changes
  const handleSave = async () => {
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      await updateTeam({
        teamId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditing(false);
      toast.success("Team updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove member
  const handleRemoveMember = async (userId: Id<"users">) => {
    try {
      await removeMember({ teamId, userId });
      toast.success("Member removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    }
  };

  // Set lead
  const handleSetLead = async (userId: Id<"users">) => {
    try {
      await setLead({ teamId, userId });
      toast.success("Team lead updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team lead");
    }
  };

  if (team === undefined || members === undefined) {
    return <TeamDetailSkeleton />;
  }

  if (team === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/teams"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-muted-foreground"
        >
          <ArrowLeft className="size-4" data-icon="inline-start" />
          Back to Teams
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Team not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/teams"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-muted-foreground"
      >
        <ArrowLeft className="size-4" data-icon="inline-start" />
        Back to Teams
      </Link>

      {/* Team header */}
      <div className="bg-background rounded-lg border border-border p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Team name"
                    className="text-2xl font-bold"
                  />
                </div>
                <div>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Team description"
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleSave} disabled={isSaving || !editName.trim()}>
                    <Save className="size-4" data-icon="inline-start" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="size-4" data-icon="inline-start" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
                  <Button variant="ghost" size="icon" onClick={handleStartEdit}>
                    <Pencil className="size-4" />
                  </Button>
                </div>
                {team.description && (
                  <p className="mt-2 text-muted-foreground">{team.description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-5" />
            <span>{team.memberCount} members</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="size-5" />
            <span>{team.assignedCourseCount} courses assigned</span>
          </div>
        </div>

        {/* Lead */}
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Team Lead</h3>
          {team.lead ? (
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={team.lead.avatarUrl} alt={team.lead.name} />
                <AvatarFallback>
                  {(team.lead.name as string)
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{team.lead.name}</p>
                <p className="text-sm text-muted-foreground">{team.lead.email}</p>
              </div>
              <Badge variant="secondary" className="ml-2">
                Lead
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground">No team lead assigned</p>
          )}
        </div>
      </div>

      {/* Members section */}
      <div className="bg-background rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
          <AddMemberDialog teamId={teamId} existingMemberIds={members.map((m: { _id: Id<"users"> }) => m._id)} />
        </div>

        <MembersTable
          members={members}
          onRemove={handleRemoveMember}
          onSetLead={handleSetLead}
          currentLeadId={team.leadId}
        />
      </div>
    </div>
  );
}

function TeamDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="bg-background rounded-lg border border-border p-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96" />
        <div className="mt-6 flex items-center gap-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="mt-6 pt-6 border-t border-border">
          <Skeleton className="h-4 w-20 mb-3" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-background rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full mb-2" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full mb-2" />
        ))}
      </div>
    </div>
  );
}
