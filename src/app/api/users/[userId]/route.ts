import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const apiRef: any = require("../../../../../convex/_generated/api").api;

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  try {
    // 1. Verify authentication
    const { userId: currentClerkId } = await auth();
    if (!currentClerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify admin role
    const currentUser = (await convex.query(apiRef.users.getByClerkId, {
      clerkId: currentClerkId,
    })) as { role: string; _id: string } | null;
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
