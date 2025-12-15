"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Plus, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamsTable } from "@/components/admin/teams/teams-table";
import { UsersTable } from "@/components/admin/users/users-table";
import { InviteUserModal } from "@/components/admin/users/invite-user-modal";
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
import { useUser } from "@clerk/nextjs";

export function TeamsList() {
  const [activeTab, setActiveTab] = useState("teams");
  const [search, setSearch] = useState("");
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const { user: clerkUser } = useUser();

  // Fetch teams
  const teams = useQuery(api.teams.list, {
    search: search || undefined,
  });

  // Fetch users
  const usersResult = useQuery(api.users.list, {
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

  // Delete user handler - calls API route to delete from Clerk
  const handleDeleteUser = async (userId: Id<"users">, clerkId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success("User deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Teams & Users</h1>
        {activeTab === "teams" ? (
          <Dialog open={newTeamOpen} onOpenChange={setNewTeamOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4" data-icon="inline-start" />
              New Team
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
        ) : (
          <Button onClick={() => setInviteModalOpen(true)}>
            <UserPlus className="size-4" data-icon="inline-start" />
            Invite User
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Search */}
        <div className="relative w-[373px] mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === "teams" ? "Search teams..." : "Search users..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Teams Tab Content */}
        <TabsContent value="teams" className="mt-4">
          {teams === undefined ? (
            <TableSkeleton />
          ) : (
            <TeamsTable teams={teams} onDelete={handleDeleteTeam} />
          )}
        </TabsContent>

        {/* Users Tab Content */}
        <TabsContent value="users" className="mt-4">
          {usersResult === undefined ? (
            <TableSkeleton />
          ) : (
            <UsersTable
              users={usersResult.data}
              onDelete={handleDeleteUser}
              currentClerkId={clerkUser?.id || ""}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Invite User Modal */}
      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
