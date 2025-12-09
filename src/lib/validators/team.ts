import { z } from "zod";

export const createTeamSchema = z.object({
  name: z
    .string()
    .min(2, "Team name must be at least 2 characters")
    .max(100, "Team name must be at most 100 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
  leadId: z.string().optional(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z
    .string()
    .min(2, "Team name must be at least 2 characters")
    .max(100, "Team name must be at most 100 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const addTeamMemberSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  userId: z.string().min(1, "User ID is required"),
});
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;

export const addTeamMembersSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  userIds: z.array(z.string()).min(1, "At least one user ID is required"),
});
export type AddTeamMembersInput = z.infer<typeof addTeamMembersSchema>;

export const setTeamLeadSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  userId: z.string().min(1, "User ID is required"),
});
export type SetTeamLeadInput = z.infer<typeof setTeamLeadSchema>;
