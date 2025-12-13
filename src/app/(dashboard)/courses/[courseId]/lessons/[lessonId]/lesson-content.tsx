"use client";

import { ContentRenderer } from "@/components/editor/plate-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { CheckCircle, FileText, Play, HelpCircle } from "lucide-react";
import { useState } from "react";

interface LessonContentProps {
  lesson: {
    _id: Id<"lessons">;
    type: "text" | "embed" | "quiz" | "files";
    title: string;
    content?: unknown[];
    embedConfig?: {
      url: string;
      provider: string;
    };
    quizConfig?: {
      passingScore: number;
      questions: unknown[];
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
      // Phase 2: EmbedViewer component
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="size-5" />
              Video Content
            </CardTitle>
            <CardDescription>Video player will be available soon.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-8 text-center text-muted-foreground">
              Embed viewer coming in Phase 2
            </div>
            {lesson.embedConfig?.url && (
              <p className="text-sm text-muted-foreground mt-4">
                URL: {lesson.embedConfig.url}
              </p>
            )}
          </CardContent>
        </Card>
      );

    case "quiz":
      // Phase 3: QuizPlayer component
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="size-5" />
              Quiz
            </CardTitle>
            <CardDescription>Test your knowledge with this quiz.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-8 text-center text-muted-foreground">
              Quiz player coming in Phase 3
            </div>
            {lesson.quizConfig && (
              <p className="text-sm text-muted-foreground mt-4">
                {lesson.quizConfig.questions?.length || 0} questions |{" "}
                Passing score: {lesson.quizConfig.passingScore}%
              </p>
            )}
          </CardContent>
        </Card>
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
