import { z } from "zod";

/**
 * Channel name validation regex
 * Only lowercase letters, numbers, hyphens, and underscores
 */
const CHANNEL_NAME_REGEX = /^[a-z0-9_-]+$/;

/**
 * Schema for creating a new channel
 */
export const channelFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be 80 characters or less")
    .regex(
      CHANNEL_NAME_REGEX,
      "Only lowercase letters, numbers, hyphens, and underscores"
    ),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  topic: z.string().max(200, "Topic must be 200 characters or less").optional(),
  type: z.enum(["public", "private"]),
});

export type ChannelFormValues = z.infer<typeof channelFormSchema>;

/**
 * Channel type options for RadioGroup
 */
export const CHANNEL_TYPE_OPTIONS = [
  {
    value: "public" as const,
    label: "Public",
    description: "Anyone can join this channel",
    icon: "Hash",
  },
  {
    value: "private" as const,
    label: "Private",
    description: "Only invited members can access",
    icon: "Lock",
  },
] as const;

export type ChannelType = (typeof CHANNEL_TYPE_OPTIONS)[number]["value"];
