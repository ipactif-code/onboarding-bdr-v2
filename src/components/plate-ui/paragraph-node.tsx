'use client';

import { PlateElement, type PlateElementProps } from 'platejs/react';
import * as React from 'react';

export function ParagraphElement(props: PlateElementProps): React.ReactElement {
  return (
    <PlateElement
      {...props}
      className="px-0.5 py-[3px]"
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        backgroundColor: props.element.backgroundColor as any,
      }}
    >
      {props.children}
    </PlateElement>
  );
}
