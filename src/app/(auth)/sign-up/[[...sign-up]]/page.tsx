import type { ReactElement } from "react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage(): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
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
