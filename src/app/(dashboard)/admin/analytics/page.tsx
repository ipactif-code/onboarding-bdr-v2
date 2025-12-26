import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { AnalyticsDashboard } from "./analytics-dashboard";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;

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
