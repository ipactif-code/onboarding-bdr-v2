'use client';

import emojiMartData from '@emoji-mart/data';
import { EmojiInputPlugin, EmojiPlugin } from '@platejs/emoji/react';
import { EmojiInputElement } from '@/components/plate-ui/emoji-node';

export const EmojiKit = [
  EmojiPlugin.configure({
    options: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- EmojiMartData type mismatch with @emoji-mart/data
      data: emojiMartData as any,
    },
  }),
  EmojiInputPlugin.withComponent(EmojiInputElement),
];
