import { SlateElement, type SlateElementProps } from 'platejs/static';
import * as React from 'react';

export function ParagraphElementStatic(props: SlateElementProps): React.ReactElement {
  return (
    <SlateElement
      {...props}
      className="my-px px-0.5 py-[3px]"
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        backgroundColor: props.element.backgroundColor as any,
      }}
    >
      {props.children}
    </SlateElement>
  );
}
