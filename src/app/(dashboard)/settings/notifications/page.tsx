import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NotificationForm } from "./_components/notification-form";

export const metadata = {
  title: "Notification Preferences | Settings",
  description: "Manage your notification preferences and Do Not Disturb settings",
};

/**
 * Notification preferences settings page.
 * Allows users to configure which notifications they receive and when.
 */
export default async function NotificationSettingsPage(): Promise<React.ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Notification Preferences
        </h1>
        <p className="text-muted-foreground">
          Control how and when you receive notifications
        </p>
      </div>

      <NotificationForm />
    </div>
  );
}
