import { BaseAlignKit } from './plugins/align-base-kit';
import { BaseBasicBlocksKit } from './plugins/basic-blocks-base-kit';
import { BaseBasicMarksKit } from './plugins/basic-marks-base-kit';
import { BaseCalloutKit } from './plugins/callout-base-kit';
import { BaseCodeBlockKit } from './plugins/code-block-base-kit';
import { ColumnKit } from './plugins/column-kit';
import { CommentKit } from './plugins/comment-kit';
import { BaseDateKit } from './plugins/date-base-kit';
import { EmojiKit } from './plugins/emoji-kit';
import { BaseFontKit } from './plugins/font-base-kit';
import { BaseLineHeightKit } from './plugins/line-height-base-kit';
import { LinkKit } from './plugins/link-kit';
import { BaseListKit } from './plugins/list-base-kit';
import { MarkdownKit } from './plugins/markdown-kit';
import { BaseMathKit } from './plugins/math-base-kit';
import { MediaKit } from './plugins/media-kit';
import { BaseMentionKit } from './plugins/mention-base-kit';
import { SuggestionKit } from './plugins/suggestion-kit';
import { TableKit } from './plugins/table-kit';
import { BaseTocKit } from './plugins/toc-base-kit';
import { BaseToggleKit } from './plugins/toggle-base-kit';

export const BaseEditorKit = [
  ...BaseBasicBlocksKit,
  ...BaseCodeBlockKit,
  ...TableKit,
  ...BaseToggleKit,
  ...BaseTocKit,
  ...MediaKit,
  ...BaseCalloutKit,
  ...ColumnKit,
  ...BaseMathKit,
  ...BaseDateKit,
  ...LinkKit,
  ...BaseMentionKit,
  ...BaseBasicMarksKit,
  ...BaseFontKit,
  ...BaseListKit,
  ...BaseAlignKit,
  ...BaseLineHeightKit,
  ...CommentKit,
  ...SuggestionKit,
  ...MarkdownKit,
  ...EmojiKit,
];
