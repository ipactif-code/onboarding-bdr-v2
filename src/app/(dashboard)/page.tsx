import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { UserDashboard } from "@/components/dashboard/user-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user from Convex to check role
  let user = await convex.query(api.users.getByClerkId, { clerkId: userId });

  // If user doesn't exist in Convex yet, create them
  if (!user) {
    const clerkUser = await currentUser();

    if (!clerkUser) {
      redirect("/sign-in");
    }

    // Create user in Convex via mutation
    try {
      await convex.mutation(api.users.createFromClerk, {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? `${userId}@unknown.com`,
        name: clerkUser.firstName
          ? `${clerkUser.firstName}${clerkUser.lastName ? ` ${clerkUser.lastName}` : ''}`
          : clerkUser.emailAddresses[0]?.emailAddress?.split('@')[0] ?? 'User',
        avatarUrl: clerkUser.imageUrl,
      });

      // Fetch the newly created user
      user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    } catch (error) {
      console.error("Failed to create user in Convex:", error);
      // Don't redirect to sign-in, show an error state or retry
    }
  }

  // If still no user after creation attempt, show loading/error state
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}
