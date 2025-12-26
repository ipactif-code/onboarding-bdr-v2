import type { AutoformatRule } from '@platejs/autoformat';

import { AutoformatPlugin } from '@platejs/autoformat';
import {
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
} from '@platejs/basic-nodes/react';
import { BaseIndentPlugin } from '@platejs/indent';
import { LinkPlugin } from '@platejs/link/react';
import { BaseListPlugin, toggleList } from '@platejs/list';
import { MentionPlugin, MentionInputPlugin } from '@platejs/mention/react';
import { KEYS, SingleBlockPlugin } from 'platejs';

import { MessageLinkElement } from './message-link-element';
import { MentionInputMessaging } from './mention-input-messaging';
import { MentionElement } from '@/components/ui/mention-node';
import { CodeLeaf } from '@/components/ui/code-node';
import { BlockListStatic } from '@/components/ui/block-list-static';

/**
 * Autoformat rules for messaging - minimal set for markdown shortcuts.
 * Only includes marks (bold, italic, code, strikethrough) and simple lists.
 * Excludes headings, blockquotes, code blocks, etc. for simpler messaging.
 */
export const MessageAutoformatMarks: AutoformatRule[] = [
  {
    match: '**',
    mode: 'mark',
    type: KEYS.bold,
  },
  {
    match: '*',
    mode: 'mark',
    type: KEYS.italic,
  },
  {
    match: '_',
    mode: 'mark',
    type: KEYS.italic,
  },
  {
    match: '~~',
    mode: 'mark',
    type: KEYS.strikethrough,
  },
  {
    match: '`',
    mode: 'mark',
    type: KEYS.code,
  },
];

export const MessageAutoformatLists: AutoformatRule[] = [
  {
    match: ['* ', '- '],
    mode: 'block',
    type: 'list',
    format: (editor) => {
      toggleList(editor, {
        listStyleType: KEYS.ul,
      });
    },
  },
  {
    match: [String.raw`^\d+\.$ `, String.raw`^\d+\)$ `],
    matchByRegex: true,
    mode: 'block',
    type: 'list',
    format: (editor, { matchString }) => {
      toggleList(editor, {
        listRestartPolite: Number(matchString) || 1,
        listStyleType: KEYS.ol,
      });
    },
  },
];

const MessageAutoformatRules: AutoformatRule[] = [
  ...MessageAutoformatMarks,
  ...MessageAutoformatLists,
];

/**
 * Minimal plugins for messaging - includes:
 * - Basic text formatting (bold, italic, strikethrough, code)
 * - Links with custom rendering
 * - Lists (bullet and numbered) with autoformat triggers
 * - Autoformat for markdown shortcuts (**bold**, *italic*, `code`, etc.)
 * - @mentions with user autocomplete
 *
 * Keeps the message input lightweight compared to the full editor.
 */
export const MessageInputPlugins = [
  // SingleBlockPlugin ensures Shift+Enter inserts soft line breaks (\n)
  // within the same block instead of creating new blocks
  SingleBlockPlugin,
  BoldPlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  CodePlugin.configure({
    node: { component: CodeLeaf },
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),
  LinkPlugin.configure({
    render: {
      node: MessageLinkElement,
    },
  }),
  // Indent and List plugins for bullet/numbered list support
  BaseIndentPlugin.configure({
    inject: {
      targetPlugins: [KEYS.p],
    },
    options: {
      offset: 24,
    },
  }),
  BaseListPlugin.configure({
    inject: {
      targetPlugins: [KEYS.p],
    },
    render: {
      belowNodes: BlockListStatic,
    },
  }),
  // Autoformat for markdown shortcuts
  AutoformatPlugin.configure({
    options: {
      enableUndoOnDelete: true,
      rules: MessageAutoformatRules,
    },
  }),
  // Mention plugin for @mentions
  MentionPlugin.configure({
    options: {
      trigger: '@',
      triggerPreviousCharPattern: /^$|^[\s"']$/,
      insertSpaceAfterMention: true,
    },
  }).withComponent(MentionElement),
  MentionInputPlugin.withComponent(MentionInputMessaging),
];
