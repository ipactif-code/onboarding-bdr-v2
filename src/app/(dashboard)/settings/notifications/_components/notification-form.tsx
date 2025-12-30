"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { Loader2, Bell, BellOff, Volume2, Monitor, AtSign, MessageSquare, Hash } from "lucide-react";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import {
  notificationPreferencesSchema,
  type NotificationPreferencesFormValues,
  DEFAULT_NOTIFICATION_PREFERENCES,
  HOUR_OPTIONS,
} from "@/lib/validators/notification-preferences";

/**
 * Form component for managing notification preferences.
 * Loads current preferences from Convex and provides real-time updates.
 */
export function NotificationForm(): React.ReactElement {
  const preferences = useQuery(api.notificationPreferences.getPreferences);
  const updatePreferences = useMutation(api.notificationPreferences.updatePreferences);

  const form = useForm<NotificationPreferencesFormValues>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: DEFAULT_NOTIFICATION_PREFERENCES,
  });

  const { isSubmitting } = form.formState;
  const doNotDisturbEnabled = form.watch("doNotDisturbEnabled");

  // Sync form with loaded preferences
  useEffect(() => {
    if (preferences) {
      form.reset({
        mentions: preferences.mentions,
        directMessages: preferences.directMessages,
        channelMessages: preferences.channelMessages,
        desktopNotifications: preferences.desktopNotifications,
        soundEnabled: preferences.soundEnabled,
        doNotDisturbEnabled:
          preferences.doNotDisturbStart !== null &&
          preferences.doNotDisturbEnd !== null,
        doNotDisturbStart: preferences.doNotDisturbStart,
        doNotDisturbEnd: preferences.doNotDisturbEnd,
      });
    }
  }, [preferences, form]);

  const onSubmit = async (data: NotificationPreferencesFormValues): Promise<void> => {
    try {
      await updatePreferences({
        mentions: data.mentions,
        directMessages: data.directMessages,
        channelMessages: data.channelMessages,
        desktopNotifications: data.desktopNotifications,
        soundEnabled: data.soundEnabled,
        doNotDisturbStart: data.doNotDisturbEnabled ? data.doNotDisturbStart : null,
        doNotDisturbEnd: data.doNotDisturbEnabled ? data.doNotDisturbEnd : null,
      });
      toast.success("Notification preferences saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save preferences";
      toast.error(message);
    }
  };

  const handleRequestNotificationPermission = async (): Promise<void> => {
    if (!("Notification" in window)) {
      toast.error("Desktop notifications are not supported in this browser");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Desktop notifications enabled");
        form.setValue("desktopNotifications", true, { shouldDirty: true });
      } else if (permission === "denied") {
        toast.error("Notification permission denied. Check your browser settings.");
      } else {
        toast.info("Notification permission request dismissed");
      }
    } catch {
      toast.error("Failed to request notification permission");
    }
  };

  // Show skeleton while loading preferences
  if (preferences === undefined) {
    return <NotificationFormSkeleton />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Notification Triggers Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5" />
              Notification Triggers
            </CardTitle>
            <CardDescription>
              Choose which events trigger notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="mentions"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <AtSign className="size-4 text-muted-foreground" />
                      Mentions
                    </FormLabel>
                    <FormDescription>
                      Notify me when I&apos;m @mentioned in a message
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="directMessages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <MessageSquare className="size-4 text-muted-foreground" />
                      Direct Messages
                    </FormLabel>
                    <FormDescription>
                      Notify me of new direct messages
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channelMessages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Hash className="size-4 text-muted-foreground" />
                      Channel Messages
                    </FormLabel>
                    <FormDescription>
                      Notify me of new messages in channels I&apos;ve joined
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Notification Methods Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="size-5" />
              Notification Methods
            </CardTitle>
            <CardDescription>
              How you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="desktopNotifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Monitor className="size-4 text-muted-foreground" />
                      Desktop Notifications
                    </FormLabel>
                    <FormDescription>
                      Show desktop notifications when you&apos;re not focused on the app
                    </FormDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {"Notification" in (typeof window !== "undefined" ? window : {}) &&
                      Notification.permission !== "granted" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRequestNotificationPermission}
                        >
                          Request Permission
                        </Button>
                      )}
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={
                          typeof window !== "undefined" &&
                          "Notification" in window &&
                          Notification.permission === "denied"
                        }
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="soundEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Volume2 className="size-4 text-muted-foreground" />
                      Notification Sounds
                    </FormLabel>
                    <FormDescription>
                      Play a sound when you receive notifications
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Do Not Disturb Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellOff className="size-5" />
              Do Not Disturb
            </CardTitle>
            <CardDescription>
              Schedule quiet hours when notifications are muted
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="doNotDisturbEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Do Not Disturb Schedule
                    </FormLabel>
                    <FormDescription>
                      Mute notifications during specific hours
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {doNotDisturbEnabled && (
              <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-6">
                <FormField
                  control={form.control}
                  name="doNotDisturbStart"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Start Time</FormLabel>
                      <Select
                        value={field.value?.toString() ?? ""}
                        onValueChange={(value) =>
                          field.onChange(value ? parseInt(value, 10) : null)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {HOUR_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <span className="hidden text-muted-foreground sm:block">to</span>

                <FormField
                  control={form.control}
                  name="doNotDisturbEnd"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>End Time</FormLabel>
                      <Select
                        value={field.value?.toString() ?? ""}
                        onValueChange={(value) =>
                          field.onChange(value ? parseInt(value, 10) : null)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {HOUR_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            )}
            Save Preferences
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Skeleton loader displayed while preferences are being fetched
 */
function NotificationFormSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Notification Triggers Card Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notification Methods Card Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Do Not Disturb Card Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Submit Button Skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}
