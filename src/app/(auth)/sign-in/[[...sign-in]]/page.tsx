import type { ReactElement } from "react";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage(): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
