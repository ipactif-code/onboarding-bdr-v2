import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // 1. Verify authentication
    const { userId: currentClerkId } = await auth();
    if (!currentClerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify admin role
    const currentUser = await convex.query(api.users.getByClerkId, {
      clerkId: currentClerkId,
    });
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Get target clerkId from body
    const body = await request.json().catch(() => ({}));
    const { clerkId: targetClerkId } = body;

    if (!targetClerkId) {
      return NextResponse.json({ error: "clerkId required" }, { status: 400 });
    }

    // 4. Prevent self-deletion
    if (targetClerkId === currentClerkId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    // 5. Delete from Clerk (webhook will clean up Convex)
    try {
      const client = await clerkClient();
      await client.users.deleteUser(targetClerkId);
      console.log(`Deleted user ${targetClerkId} from Clerk`);
    } catch (clerkError: unknown) {
      console.error("Clerk deletion error:", clerkError);

      const error = clerkError as { status?: number };
      if (error?.status !== 404) {
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
      }
      // If 404, user no longer exists in Clerk - that's OK
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
