import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message must be at most 10000 characters"),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const sendDirectMessageSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message must be at most 10000 characters"),
});
export type SendDirectMessageInput = z.infer<typeof sendDirectMessageSchema>;

export const broadcastMessageSchema = z.object({
  recipientIds: z.array(z.string()).min(1, "At least one recipient is required"),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message must be at most 10000 characters"),
});
export type BroadcastMessageInput = z.infer<typeof broadcastMessageSchema>;

export const searchMessagesSchema = z.object({
  query: z.string().min(2, "Search query must be at least 2 characters"),
  conversationId: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});
export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;
