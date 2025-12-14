import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { AnalyticsDashboard } from "./analytics-dashboard";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function AdminAnalyticsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check admin role
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <AnalyticsDashboard />;
}
