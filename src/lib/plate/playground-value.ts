import type { TElement } from 'platejs';

/**
 * Default empty document value for the Plate editor.
 * This can be customized with initial content as needed.
 */
export const playgroundValue: TElement[] = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
];
