import { BaseCaptionPlugin } from '@platejs/caption';
import {
  BaseAudioPlugin,
  BaseFilePlugin,
  BaseImagePlugin,
  BaseMediaEmbedPlugin,
  BasePlaceholderPlugin,
  BaseVideoPlugin,
} from '@platejs/media';
import { KEYS } from 'platejs';

import { MediaAudioElementStatic } from '@/components/plate-ui/media-audio-node-static';
import { MediaFileElementStatic } from '@/components/plate-ui/media-file-node-static';
import { ImageElementStatic } from '@/components/plate-ui/media-image-node-static';
import { MediaVideoElementStatic } from '@/components/plate-ui/media-video-node-static';

export const BaseMediaKit = [
  BaseImagePlugin.withComponent(ImageElementStatic),
  BaseVideoPlugin.withComponent(MediaVideoElementStatic),
  BaseAudioPlugin.withComponent(MediaAudioElementStatic),
  BaseFilePlugin.withComponent(MediaFileElementStatic),
  BaseCaptionPlugin.configure({
    options: {
      query: {
        allow: [KEYS.img, KEYS.video, KEYS.audio, KEYS.file, KEYS.mediaEmbed],
      },
    },
  }),
  BaseMediaEmbedPlugin,
  BasePlaceholderPlugin,
];
