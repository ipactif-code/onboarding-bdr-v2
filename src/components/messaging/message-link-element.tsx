'use client';

import * as React from 'react';

import type { TLinkElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { getLinkAttributes } from '@platejs/link';
import { PlateElement } from 'platejs/react';

import { cn } from '@/lib/utils';

/**
 * Simplified link element for the message input.
 * Unlike the full LinkElement, this doesn't depend on SuggestionPlugin
 * since the message input uses a minimal plugin set.
 */
export function MessageLinkElement(props: PlateElementProps<TLinkElement>): React.ReactElement {
  return (
    <PlateElement
      {...props}
      as="a"
      className={cn(
        'font-medium text-primary underline decoration-primary underline-offset-4',
        'cursor-pointer hover:text-primary/80'
      )}
      attributes={{
        ...props.attributes,
        ...getLinkAttributes(props.editor, props.element),
        onMouseOver: (e) => {
          e.stopPropagation();
        },
      }}
    >
      {props.children}
    </PlateElement>
  );
}
