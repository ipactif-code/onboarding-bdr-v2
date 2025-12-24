import type { Id } from "../../../../convex/_generated/dataModel";
import type { Status } from "../online-indicator";

// ============================================================================
// Types
// ============================================================================

export type ChannelRole = "owner" | "admin" | "moderator" | "member";

export interface ChannelMembersDialogProps {
  channelId: Id<"channels">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current user's role in the channel - determines what actions are available */
  userRole?: ChannelRole;
}

export interface MemberInfo {
  _id: Id<"channelMembers">;
  userId: Id<"users">;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  userStatus: Status;
  role: ChannelRole;
  joinedAt: number;
}

export interface UserSearchResult {
  _id: Id<"users">;
  name: string;
  email: string;
  avatarUrl?: string;
  status: Status;
}
