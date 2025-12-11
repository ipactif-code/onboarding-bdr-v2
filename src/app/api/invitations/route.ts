import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Check if current user is admin (getByClerkId is public, no auth required)
    const currentUser = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { email, role } = body;

    // 4. Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // 5. Validate role
    const validRoles = ["user", "admin"];
    const userRole = role && validRoles.includes(role) ? role : "user";

    // 6. Create Clerk invitation
    // Note: Clerk will handle duplicate email detection automatically
    const client = await clerkClient();
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        role: userRole,
      },
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-up`,
    });

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      invitationId: invitation.id,
    });

  } catch (error: unknown) {
    console.error("Error creating invitation:", error);

    // Handle Clerk-specific errors
    const clerkError = error as { errors?: Array<{ code?: string; message?: string; meta?: { paramName?: string } }> };
    if (clerkError?.errors) {
      const clerkErrors = clerkError.errors;

      // Check for duplicate email error
      const duplicateError = clerkErrors.find(
        (e) => e.code === "form_identifier_exists" ||
               e.message?.includes("already exists") ||
               e.message?.includes("taken")
      );

      if (duplicateError) {
        return NextResponse.json(
          { error: "A user with this email already exists or has a pending invitation" },
          { status: 400 }
        );
      }

      // Check for invalid email error
      const invalidEmailError = clerkErrors.find(
        (e) => e.code === "form_param_format_invalid" &&
               e.meta?.paramName === "email_address"
      );

      if (invalidEmailError) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 }
        );
      }

      // Return first Clerk error message
      return NextResponse.json(
        { error: clerkErrors[0]?.message || "Failed to create invitation" },
        { status: 400 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: "Failed to create invitation. Please try again." },
      { status: 500 }
    );
  }
}
