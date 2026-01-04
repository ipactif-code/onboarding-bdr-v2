import Link from "next/link";
import { FileXIcon, ArrowLeftIcon, HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Not Found page for Knowledge Base documents.
 *
 * Displayed when:
 * - Document ID is invalid
 * - Document has been permanently deleted
 * - User lacks permission to access the document
 */
export default function DocumentNotFound(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center text-center">
        {/* Icon */}
        <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
          <FileXIcon className="size-10 text-muted-foreground" />
        </div>

        {/* Title */}
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Document Not Found
        </h1>

        {/* Description */}
        <p className="mb-8 text-muted-foreground">
          The document you&apos;re looking for doesn&apos;t exist, has been
          deleted, or you don&apos;t have permission to view it.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="default"
            nativeButton={false}
            render={<Link href="/knowledge" />}
            className="gap-2"
          >
            <HomeIcon className="size-4" />
            Go to Knowledge Base
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
            className="gap-2"
          >
            <ArrowLeftIcon className="size-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Help text */}
        <p className="mt-8 text-sm text-muted-foreground">
          If you believe this is an error, please contact your administrator.
        </p>
      </div>
    </div>
  );
}
