"use client";

import * as React from "react";
import { type Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { EditorKit } from "@/components/editor/editor-kit";
import { Editor, EditorContainer } from "@/components/plate-ui/editor";
import { Card, CardContent } from "@/components/ui/card";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { EmbedViewer } from "@/components/lessons/embed-viewer";
import { QuizPlayer } from "@/components/lessons/quiz-player";
import { FilesList } from "@/components/lessons/files-list";

interface LessonContentProps {
  lesson: {
    _id: Id<"lessons">;
    type: "text" | "embed" | "quiz" | "files";
    title: string;
    content?: unknown[];
    embedConfig?: {
      url: string;
      provider: "youtube" | "vimeo" | "loom" | "figma" | "other";
    };
    quizConfig?: {
      passingScore: number;
      allowRetry: boolean;
      maxAttempts?: number;
      showAnswers: boolean;
      questions: Array<{
        _id: Id<"quizQuestions">;
        questionText: string;
        options: Array<{
          text: string;
          isCorrect: boolean;
        }>;
        explanation?: string;
        points: number;
        displayOrder: number;
      }>;
    };
    files?: Array<{
      _id: Id<"files">;
      fileName: string;
      fileSize: number;
      fileType: string;
      downloadUrl: string;
    }>;
  };
  courseId: string;
}

/**
 * Read-only Plate editor component for displaying lesson content.
 */
function ReadOnlyEditor({ value }: { value: unknown[] }): React.ReactElement {
  const initialValue: Value = React.useMemo(() => {
    if (value && Array.isArray(value) && value.length > 0) {
      return value as Value;
    }
    // Default empty paragraph
    return [{ type: "p", children: [{ text: "" }] }] as Value;
  }, [value]);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  return (
    <Plate editor={editor} readOnly>
      <EditorContainer>
        <Editor readOnly />
      </EditorContainer>
    </Plate>
  );
}

export function LessonContent({ lesson }: LessonContentProps): React.ReactElement {
  switch (lesson.type) {
    case "text":
      return (
        <div className="space-y-6">
          {lesson.content && lesson.content.length > 0 ? (
            <ReadOnlyEditor value={lesson.content} />
          ) : (
            <p className="text-muted-foreground italic">
              No content available for this lesson.
            </p>
          )}
        </div>
      );

    case "embed":
      return (
        <div className="space-y-6">
          {lesson.embedConfig?.url && lesson.embedConfig?.provider ? (
            <EmbedViewer
              url={lesson.embedConfig.url}
              provider={lesson.embedConfig.provider}
              title={lesson.title}
            />
          ) : (
            <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center">
              <p className="text-muted-foreground">No video configured for this lesson.</p>
            </div>
          )}
          {lesson.content && lesson.content.length > 0 && (
            <ReadOnlyEditor value={lesson.content} />
          )}
        </div>
      );

    case "quiz":
      if (!lesson.quizConfig || !lesson.quizConfig.questions.length) {
        return (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No quiz configured for this lesson.
              </p>
            </CardContent>
          </Card>
        );
      }

      return (
        <QuizPlayer
          lessonId={lesson._id}
          quizConfig={lesson.quizConfig}
          lessonTitle={lesson.title}
        />
      );

    case "files":
      return (
        <FilesList
          lessonId={lesson._id}
          files={lesson.files || []}
        />
      );

    default:
      return (
        <div className="text-muted-foreground">
          Unknown lesson type: {lesson.type}
        </div>
      );
  }
}
