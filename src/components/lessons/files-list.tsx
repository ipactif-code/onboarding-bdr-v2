"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  CheckCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileItem {
  _id: Id<"files">;
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadUrl: string;
}

interface FilesListProps {
  lessonId: Id<"lessons">;
  files: FileItem[];
}

/**
 * Format file size from bytes to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Get appropriate icon based on file MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return FileImage;
  }
  if (mimeType.startsWith("video/")) {
    return FileVideo;
  }
  if (mimeType.startsWith("audio/")) {
    return FileAudio;
  }
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("compressed")) {
    return FileArchive;
  }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    return FileSpreadsheet;
  }
  if (mimeType.includes("pdf")) {
    return FileText;
  }
  if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("css") || mimeType.includes("code")) {
    return FileCode;
  }
  if (mimeType.startsWith("text/") || mimeType.includes("document") || mimeType.includes("word")) {
    return FileText;
  }

  return File;
}

/**
 * Get file type label from MIME type
 */
function getFileTypeLabel(mimeType: string): string {
  const typeMap: Record<string, string> = {
    "application/pdf": "PDF",
    "application/zip": "ZIP",
    "application/x-rar-compressed": "RAR",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-powerpoint": "PPT",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "text/plain": "TXT",
    "text/csv": "CSV",
    "text/html": "HTML",
    "text/css": "CSS",
    "text/javascript": "JS",
    "application/json": "JSON",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/gif": "GIF",
    "image/svg+xml": "SVG",
    "image/webp": "WEBP",
    "video/mp4": "MP4",
    "video/webm": "WEBM",
    "audio/mpeg": "MP3",
    "audio/wav": "WAV",
  };

  return typeMap[mimeType] || mimeType.split("/").pop()?.toUpperCase() || "FILE";
}

/**
 * Check if file is a code file that should be force-downloaded
 * (not opened in browser)
 */
function isCodeFile(mimeType: string, fileName: string): boolean {
  const codeExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.html', '.xml',
    '.md', '.yml', '.yaml', '.sh', '.py', '.rb', '.php', '.sql', '.env'
  ];
  const codeMimeTypes = [
    'application/json',
    'application/javascript',
    'text/javascript',
    'text/css',
    'text/html',
    'text/xml',
    'text/markdown'
  ];

  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  return codeExtensions.includes(ext) || codeMimeTypes.includes(mimeType);
}

export function FilesList({ lessonId, files }: FilesListProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<Id<"files"> | null>(null);
  const markCompleted = useMutation(api.progress.markCompleted);

  const handleMarkComplete = async () => {
    try {
      await markCompleted({ lessonId });
      setIsCompleted(true);
    } catch (error) {
      console.error("Failed to mark lesson as completed:", error);
    }
  };

  const handleDownloadClick = (fileId: string) => {
    setDownloadedFiles((prev) => new Set([...prev, fileId]));
  };

  const forceDownload = async (file: FileItem) => {
    try {
      setDownloadingId(file._id);
      const response = await fetch(file.downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setDownloadedFiles((prev) => new Set([...prev, file._id]));
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  if (!files || files.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No files available for this lesson.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Files list */}
      <div className="space-y-3">
        {files.map((file) => {
          const FileIcon = getFileIcon(file.fileType);
          const isDownloaded = downloadedFiles.has(file._id);

          return (
            <Card
              key={file._id}
              className={cn(
                "transition-colors",
                isDownloaded && "bg-muted/50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* File icon */}
                  <div className="flex-shrink-0 p-3 bg-primary/10 rounded-lg">
                    <FileIcon className="h-6 w-6 text-primary" />
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" title={file.fileName}>
                      {file.fileName}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{getFileTypeLabel(file.fileType)}</span>
                      <span>•</span>
                      <span>{formatFileSize(file.fileSize)}</span>
                      {isDownloaded && (
                        <>
                          <span>•</span>
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Downloaded
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Download button - hybrid logic */}
                  {isCodeFile(file.fileType, file.fileName) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => forceDownload(file)}
                      disabled={downloadingId === file._id}
                    >
                      {downloadingId === file._id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Downloading...
                        </>
                      ) : isDownloaded ? (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download Again
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-shrink-0"
                    >
                      <a
                        href={file.downloadUrl}
                        download={file.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDownloadClick(file._id)}
                      >
                        {isDownloaded ? (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </>
                        )}
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground text-center">
        {files.length} file{files.length > 1 ? "s" : ""} •
        Total: {formatFileSize(files.reduce((sum, f) => sum + f.fileSize, 0))}
      </p>

      {/* Mark as Complete button */}
      <div className="pt-6 border-t">
        <Button
          onClick={handleMarkComplete}
          disabled={isCompleted}
          className="w-full sm:w-auto"
        >
          {isCompleted ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Completed
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Complete
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
