"use client";

import { ContentRenderer } from "@/components/editor/plate-editor";
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

export function LessonContent({ lesson }: LessonContentProps) {
  switch (lesson.type) {
    case "text":
      return (
        <div className="space-y-6">
          {lesson.content && lesson.content.length > 0 ? (
            <ContentRenderer value={lesson.content} className="prose prose-neutral max-w-none" />
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
            <ContentRenderer value={lesson.content} className="prose prose-neutral max-w-none" />
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
