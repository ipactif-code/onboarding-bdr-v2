"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { toast } from "sonner";
import { Loader2, Hash, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { channelFormSchema, type ChannelFormValues, CHANNEL_TYPE_OPTIONS } from "@/lib/validators/channel";

const ICONS = { Hash, Lock } as const;

interface ChannelCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (channelId: Id<"channels">) => void;
}

export function ChannelCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: ChannelCreateDialogProps): React.ReactElement {
  const createChannel = useMutation(api.channels.create);
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: { name: "", description: "", topic: "", type: "public" },
  });

  const { isSubmitting, isValid } = form.formState;
  const descriptionValue = form.watch("description") ?? "";

  const onSubmit = async (data: ChannelFormValues): Promise<void> => {
    try {
      const channelId = await createChannel({
        name: data.name,
        description: data.description || undefined,
        topic: data.topic || undefined,
        type: data.type,
      });
      toast.success("Channel created successfully");
      form.reset();
      onOpenChange(false);
      onSuccess?.(channelId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create channel";
      toast.error(message);
    }
  };

  const handleNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: string) => void
  ): void => {
    onChange(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, ""));
  };

  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen) form.reset();
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <DialogDescription>Create a new channel for team communication.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., general-discussion"
                      {...field}
                      onChange={(e) => handleNameChange(e, field.onChange)}
                    />
                  </FormControl>
                  <FormDescription>Lowercase letters, numbers, hyphens, and underscores only.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Description</FormLabel>
                    <span className="text-xs text-muted-foreground">{descriptionValue.length}/500</span>
                  </div>
                  <FormControl>
                    <Textarea placeholder="What is this channel about?" className="min-h-20 resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input placeholder="Current discussion topic (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Type</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3">
                      {CHANNEL_TYPE_OPTIONS.map((opt) => {
                        const Icon = ICONS[opt.icon];
                        const isSelected = field.value === opt.value;
                        return (
                          <Label
                            key={opt.value}
                            htmlFor={`type-${opt.value}`}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                              isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                            )}
                          >
                            <RadioGroupItem value={opt.value} id={`type-${opt.value}`} />
                            <div className="grid gap-1">
                              <div className="flex items-center gap-2 font-medium">
                                <Icon className="size-4" />
                                {opt.label}
                              </div>
                              <p className="text-sm text-muted-foreground font-normal">{opt.description}</p>
                            </div>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !isValid}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
