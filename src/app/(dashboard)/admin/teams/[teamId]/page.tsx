import type { ReactElement } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { TeamDetail } from "./team-detail";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDetailPage({ params }: PageProps): Promise<ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check admin role
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const { teamId } = await params;

  return <TeamDetail teamId={teamId as Id<"teams">} />;
}
