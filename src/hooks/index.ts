// Central export for all custom hooks

export { useBreadcrumbs } from "./use-breadcrumbs";
export type { BreadcrumbItem } from "./use-breadcrumbs";

export { useMessageScroll } from "./use-message-scroll";
export { useMessageIntersection } from "./use-message-intersection";
export { useThread } from "./use-thread";

// Voice recording hooks
export {
  useVoiceRecorder,
  useVoiceSender,
  useMediaRecorder,
  useWaveformAnalyzer,
} from "./voice";
export type {
  UseVoiceRecorderOptions,
  UseVoiceRecorderReturn,
  UseVoiceSenderOptions,
  UseVoiceSenderReturn,
  UseMediaRecorderReturn,
  UseWaveformAnalyzerReturn,
} from "./voice";
