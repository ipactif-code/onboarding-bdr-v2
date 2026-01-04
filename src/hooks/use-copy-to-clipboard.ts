import * as React from 'react';

import { type ExternalToast, toast } from 'sonner';

interface UseCopyToClipboardOptions {
  timeout?: number;
}

interface UseCopyToClipboardReturn {
  copyToClipboard: (
    value: string,
    options?: { data?: ExternalToast; tooltip?: string }
  ) => void;
  isCopied: boolean;
}

export const useCopyToClipboard = ({
  timeout = 2000,
}: UseCopyToClipboardOptions = {}): UseCopyToClipboardReturn => {
  const [isCopied, setIsCopied] = React.useState(false);

  const copyToClipboard = (
    value: string,
    { data, tooltip }: { data?: ExternalToast; tooltip?: string } = {}
  ): void => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    if (!value) {
      return;
    }

    void navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
      }, timeout);
    });

    if (tooltip) {
      toast.success(tooltip, data);
    }
  };

  return { copyToClipboard, isCopied };
};
