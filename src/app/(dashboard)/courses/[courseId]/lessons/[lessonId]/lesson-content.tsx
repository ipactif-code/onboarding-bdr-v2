"use client";

import { ContentRenderer } from "@/components/editor/plate-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { CheckCircle, FileText } from "lucide-react";
import { EmbedViewer } from "@/components/lessons/embed-viewer";
import { QuizPlayer } from "@/components/lessons/quiz-player";
import { useState } from "react";

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
  const [isCompleted, setIsCompleted] = useState(false);
  const markCompleted = useMutation(api.progress.markCompleted);

  const handleMarkComplete = async () => {
    try {
      await markCompleted({ lessonId: lesson._id });
      setIsCompleted(true);
    } catch (error) {
      console.error("Failed to mark lesson as completed:", error);
    }
  };

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

          {/* Mark as Complete button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleMarkComplete}
              disabled={isCompleted}
              variant={isCompleted ? "outline" : "default"}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Completed
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Mark as Complete
                </>
              )}
            </Button>
          </div>
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

          {/* Mark as Complete button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleMarkComplete}
              disabled={isCompleted}
              variant={isCompleted ? "outline" : "default"}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Completed
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Mark as Complete
                </>
              )}
            </Button>
          </div>
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
      // Phase 4: FilesList component
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Files
            </CardTitle>
            <CardDescription>Download the course materials.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-8 text-center text-muted-foreground">
              File downloads coming in Phase 4
            </div>
            {lesson.files && lesson.files.length > 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                {lesson.files.length} file(s) available
              </p>
            )}
          </CardContent>
        </Card>
      );

    default:
      return (
        <div className="text-muted-foreground">
          Unknown lesson type: {lesson.type}
        </div>
      );
  }
}
