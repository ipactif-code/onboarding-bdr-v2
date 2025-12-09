import { z } from "zod";

export const userRoleSchema = z.enum(["user", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userStatusSchema = z.enum(["online", "offline", "away"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  avatarUrl: z.string().url("Invalid URL").optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: userRoleSchema,
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: userRoleSchema.default("user"),
  teamIds: z.array(z.string()).optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const searchUsersSchema = z.object({
  query: z.string().min(2, "Search query must be at least 2 characters"),
  limit: z.number().min(1).max(50).default(10),
});
export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
