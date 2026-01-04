'use client';

import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { PlateElement } from 'platejs/react';

export function ParagraphElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      className="px-0.5 py-[3px]"
      style={{
        backgroundColor: props.element.backgroundColor as string | undefined,
      }}
    >
      {props.children}
    </PlateElement>
  );
}
