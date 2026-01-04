'use client';

import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { type VariantProps, cva } from 'class-variance-authority';
import { PathApi } from 'platejs';
import { PlateElement } from 'platejs/react';

const headingVariants = cva(
  'relative mb-1 px-0.5 py-[3px] font-semibold leading-[1.3]!',
  {
    variants: {
      isFirstBlock: {
        false: '',
        true: 'mt-0!',
      },
      variant: {
        h1: 'mt-8 text-[1.875em]',
        h2: 'mt-[1.4em] text-[1.5em]',
        h3: 'mt-[1em] text-[1.25em]',
        h4: 'mt-[0.75em] text-[1.125em]',
        h5: 'mt-[0.75em] text-[1em]',
        h6: 'mt-[0.75em] text-[0.875em]',
      },
    },
  }
);

export function HeadingElement({
  attributes,
  variant = 'h1',
  ...props
}: PlateElementProps & VariantProps<typeof headingVariants>) {
  const isFirstBlock = PathApi.equals(props.path, [0]);

  return (
    <PlateElement
      as={variant!}
      attributes={{
        id: props.element.id as string,
        ...attributes,
      }}
      className={headingVariants({ isFirstBlock, variant })}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H1Element(props: PlateElementProps) {
  return <HeadingElement variant="h1" {...props} />;
}

export function H2Element(props: PlateElementProps) {
  return <HeadingElement variant="h2" {...props} />;
}

export function H3Element(props: PlateElementProps) {
  return <HeadingElement variant="h3" {...props} />;
}

export function H4Element(props: PlateElementProps) {
  return <HeadingElement variant="h4" {...props} />;
}

export function H5Element(props: PlateElementProps) {
  return <HeadingElement variant="h5" {...props} />;
}

export function H6Element(props: PlateElementProps) {
  return <HeadingElement variant="h6" {...props} />;
}
