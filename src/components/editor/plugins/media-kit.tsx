'use client';

import { CaptionPlugin } from '@platejs/caption/react';
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  MediaEmbedPlugin,
  PlaceholderPlugin,
  VideoPlugin,
} from '@platejs/media/react';
import { KEYS } from 'platejs';

import { MediaAudioElement } from '@/components/plate-ui/media-audio-node';
import { MediaEmbedElement } from '@/components/plate-ui/media-embed-node';
import { MediaFileElement } from '@/components/plate-ui/media-file-node';
import { ImageElement } from '@/components/plate-ui/media-image-node';
import { PlaceholderElement } from '@/components/plate-ui/media-placeholder-node';
import { ImagePreview } from '@/components/plate-ui/media-preview-dialog';
import { MediaUploadToast } from '@/components/plate-ui/media-upload-toast';
import { MediaVideoElement } from '@/components/plate-ui/media-video-node';

export const MediaKit = [
  PlaceholderPlugin.configure({
    render: {
      afterEditable: MediaUploadToast,
      node: PlaceholderElement,
    },
  }),
  ImagePlugin.configure({
    options: { disableUploadInsert: true },
    render: {
      afterEditable: ImagePreview,
      node: ImageElement,
    },
  }),
  MediaEmbedPlugin.withComponent(MediaEmbedElement),
  VideoPlugin.withComponent(MediaVideoElement),
  AudioPlugin.withComponent(MediaAudioElement),
  FilePlugin.withComponent(MediaFileElement),
  CaptionPlugin.configure({
    options: {
      query: {
        allow: [KEYS.img, KEYS.video, KEYS.audio, KEYS.mediaEmbed],
      },
    },
  }),
];
