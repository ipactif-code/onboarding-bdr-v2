// Knowledge Base hooks
// Central export for Knowledge Base document management hooks

export { useAutoSave } from "./use-auto-save";
export type { UseAutoSaveOptions, UseAutoSaveReturn } from "./use-auto-save";

export { useDocument } from "./use-document";
export type {
  UseDocumentOptions,
  UseDocumentReturn,
  DocumentMetadata,
  DocumentContent,
} from "./use-document";

export { useRecordAccess } from "./use-record-access";
export type { UseRecordAccessOptions } from "./use-record-access";
