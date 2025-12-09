import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { UserDashboard } from "@/components/dashboard/user-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user from Convex to check role
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });

  if (!user) {
    // User not synced yet, redirect to sign-in
    redirect("/sign-in");
  }

  const isAdmin = user.role === "admin";

  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}
