"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../../../convex/_generated/api").api;
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Save,
  FileText,
  Video,
  HelpCircle,
  FileIcon,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  ExternalLink,
  Clock,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { type Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { EditorKit } from "@/components/editor/editor-kit";
import { Editor, EditorContainer } from "@/components/plate-ui/editor";
import { useDebouncedCallback } from "@/hooks/use-debounce-callback";
import { sanitizeEditorContent } from "@/lib/sanitize-editor-content";
import { uploadFiles } from "@/hooks/use-upload-file";

// ============================================================================
// Types
// ============================================================================

interface Lesson {
  _id: Id<"lessons">;
  sectionId: Id<"sections">;
  courseId: Id<"courses">;
  type: "text" | "embed" | "quiz" | "files";
  title: string;
  description?: string;
  estimatedDuration?: number;
  content?: unknown;
  displayOrder: number;
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
      options: Array<{ text: string; isCorrect: boolean }>;
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
}

interface LessonEditorProps {
  lesson: Lesson;
  courseId: Id<"courses">;
  courseTitle: string;
}

const lessonTypeIcons = {
  text: FileText,
  embed: Video,
  quiz: HelpCircle,
  files: FileIcon,
};

const lessonTypeLabels = {
  text: "Text",
  embed: "Video/Embed",
  quiz: "Quiz",
  files: "Files",
};

// ============================================================================
// Main Component
// ============================================================================

export function LessonEditor({
  lesson: initialLesson,
  courseId,
  courseTitle,
}: LessonEditorProps) {
  const router = useRouter();

  // Fetch fresh lesson data
  const lesson: Lesson = useQuery(api.lessons.get, { lessonId: initialLesson._id }) ?? initialLesson;

  // Local state
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description || "");
  const [estimatedDuration, setEstimatedDuration] = useState(
    lesson.estimatedDuration?.toString() || ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Quiz settings state (only used when lesson.type === "quiz")
  const [passingScore, setPassingScore] = useState(
    lesson.quizConfig?.passingScore ?? 70
  );
  const [maxAttempts, setMaxAttempts] = useState(
    lesson.quizConfig?.maxAttempts?.toString() ?? ""
  );
  const [allowRetry, setAllowRetry] = useState(
    lesson.quizConfig?.allowRetry ?? true
  );
  const [showAnswers, setShowAnswers] = useState(
    lesson.quizConfig?.showAnswers ?? true
  );

  // Embed settings state (only used when lesson.type === "embed")
  const [embedUrl, setEmbedUrl] = useState(lesson.embedConfig?.url ?? "");
  const [embedProvider, setEmbedProvider] = useState<"youtube" | "vimeo" | "loom" | "figma" | "other">(
    lesson.embedConfig?.provider ?? "other"
  );

  // Mutations
  const updateLesson = useMutation(api.lessons.update);
  const removeLesson = useMutation(api.lessons.remove);
  const updateQuizConfig = useMutation(api.lessons.updateQuizConfig);
  const setEmbed = useMutation(api.lessons.setEmbed);

  // Update local state when lesson changes
  useEffect(() => {
    setTitle(lesson.title);
    setDescription(lesson.description || "");
    setEstimatedDuration(lesson.estimatedDuration?.toString() || "");
  }, [lesson.title, lesson.description, lesson.estimatedDuration]);

  // Update quiz settings when lesson changes
  useEffect(() => {
    if (lesson.type === "quiz" && lesson.quizConfig) {
      setPassingScore(lesson.quizConfig.passingScore ?? 70);
      setMaxAttempts(lesson.quizConfig.maxAttempts?.toString() ?? "");
      setAllowRetry(lesson.quizConfig.allowRetry ?? true);
      setShowAnswers(lesson.quizConfig.showAnswers ?? true);
    }
  }, [lesson.type, lesson.quizConfig]);

  // Update embed settings when lesson changes
  useEffect(() => {
    if (lesson.type === "embed" && lesson.embedConfig) {
      setEmbedUrl(lesson.embedConfig.url ?? "");
      setEmbedProvider(lesson.embedConfig.provider ?? "other");
    }
  }, [lesson.type, lesson.embedConfig]);

  // Apply viewport height constraints for TEXT and EMBED lessons
  // Quiz and files lessons need normal page scrolling
  useEffect(() => {
    // Only apply constraints for TEXT and EMBED lesson types
    if (lesson.type !== "text" && lesson.type !== "embed") {
      return; // Exit early - don't apply any constraints
    }

    const sidebarInset = document.querySelector('[data-slot="sidebar-inset"]') as HTMLElement;
    const mainElement = document.querySelector('main.flex.flex-1.flex-col.gap-4.p-4') as HTMLElement;

    // Apply styles
    if (sidebarInset) {
      sidebarInset.style.maxHeight = '100vh';
      sidebarInset.style.overflow = 'hidden';
    }

    if (mainElement) {
      mainElement.style.overflow = 'hidden';
      mainElement.style.minHeight = '0';
    }

    // Cleanup on unmount - remove styles so other pages work normally
    return () => {
      if (sidebarInset) {
        sidebarInset.style.maxHeight = '';
        sidebarInset.style.overflow = '';
      }
      if (mainElement) {
        mainElement.style.overflow = '';
        mainElement.style.minHeight = '';
      }
    };
  }, [lesson.type]);

  // Detect embed provider from URL
  const detectProvider = (url: string): "youtube" | "vimeo" | "loom" | "figma" | "other" => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes("vimeo.com")) return "vimeo";
    if (url.includes("loom.com")) return "loom";
    if (url.includes("figma.com")) return "figma";
    return "other";
  };

  // Save basic info (and quiz/embed config if applicable)
  const handleSaveInfo = async () => {
    setIsSaving(true);
    try {
      // Save basic lesson info
      await updateLesson({
        lessonId: lesson._id,
        title: title.trim(),
        description: description.trim() || undefined,
        estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
      });

      // If quiz lesson, also save quiz config
      if (lesson.type === "quiz") {
        await updateQuizConfig({
          lessonId: lesson._id,
          passingScore,
          allowRetry,
          maxAttempts: maxAttempts ? parseInt(maxAttempts) : undefined,
          showAnswers,
        });
      }

      // If embed lesson, also save embed config
      if (lesson.type === "embed" && embedUrl.trim()) {
        const detectedProvider = detectProvider(embedUrl.trim());
        await setEmbed({
          lessonId: lesson._id,
          url: embedUrl.trim(),
        });
        setEmbedProvider(detectedProvider);
      }

      setHasUnsavedChanges(false);
      toast.success("Lesson saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save lesson");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete lesson
  const handleDelete = async () => {
    try {
      await removeLesson({ lessonId: lesson._id });
      toast.success("Lesson deleted");
      router.push(`/admin/courses/${courseId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete lesson");
    }
  };

  const Icon = lessonTypeIcons[lesson.type];

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{lesson.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="gap-1">
              <Icon className="size-3" />
              {lessonTypeLabels[lesson.type]}
            </Badge>
            <Link
              href={`/admin/courses/${courseId}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {courseTitle}
            </Link>
          </div>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 mt-2">
              Unsaved changes
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" size="sm" className="text-red-600" />}>
              <Trash2 className="size-4" data-icon="inline-start" />
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{lesson.title}&quot; and all its
                  content. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={handleSaveInfo} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Save className="size-4" data-icon="inline-start" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Main Editor */}
        <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
          {/* Type-specific editor */}
          {lesson.type === "text" && (
            <TextLessonEditor
              lessonId={lesson._id}
              initialContent={lesson.content}
            />
          )}

          {lesson.type === "embed" && (
            <EmbedLessonEditor
              lessonId={lesson._id}
              initialContent={lesson.content}
            />
          )}

          {lesson.type === "quiz" && (
            <QuizLessonEditor
              lessonId={lesson._id}
              quizConfig={lesson.quizConfig}
            />
          )}

          {lesson.type === "files" && (
            <FilesLessonEditor
              lessonId={lesson._id}
              initialContent={lesson.content}
              files={lesson.files}
            />
          )}
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-border py-0 gap-0">
            <div className="border-b border-border bg-muted/50 px-6 py-4 rounded-t-2xl">
              <h2 className="text-lg font-semibold text-foreground">Lesson Settings</h2>
            </div>
            <CardContent className="p-6 space-y-4">
              {/* Common Settings */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Lesson title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Brief description of this lesson"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Estimated Duration (minutes)</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={estimatedDuration}
                    onChange={(e) => {
                      setEstimatedDuration(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="e.g., 15"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Quiz-specific Settings */}
              {lesson.type === "quiz" && (
                <>
                  <Separator className="my-4" />

                  <h3 className="text-sm font-semibold text-muted-foreground">Quiz Settings</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="passing-score">Passing Score (%)</Label>
                      <Input
                        id="passing-score"
                        type="number"
                        min="1"
                        max="100"
                        value={passingScore}
                        onChange={(e) => {
                          setPassingScore(parseInt(e.target.value) || 70);
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-attempts">Max Attempts</Label>
                      <Input
                        id="max-attempts"
                        type="number"
                        min="1"
                        max="10"
                        value={maxAttempts}
                        onChange={(e) => {
                          setMaxAttempts(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Retry</Label>
                      <p className="text-xs text-muted-foreground">
                        Users can retake the quiz after failing
                      </p>
                    </div>
                    <Switch
                      checked={allowRetry}
                      onCheckedChange={(checked) => {
                        setAllowRetry(checked);
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Show Correct Answers</Label>
                      <p className="text-xs text-muted-foreground">
                        Display correct answers after submission
                      </p>
                    </div>
                    <Switch
                      checked={showAnswers}
                      onCheckedChange={(checked) => {
                        setShowAnswers(checked);
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </>
              )}

              {/* Embed-specific Settings */}
              {lesson.type === "embed" && (
                <>
                  <Separator className="my-4" />

                  <h3 className="text-sm font-semibold text-muted-foreground">Embed Settings</h3>

                  <div className="space-y-2">
                    <Label htmlFor="embed-url">Embed URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="embed-url"
                        value={embedUrl}
                        onChange={(e) => {
                          setEmbedUrl(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1"
                      />
                      {embedUrl && (
                        <Button variant="outline" size="icon" render={<a href={embedUrl} target="_blank" rel="noopener noreferrer" />}>
                          <ExternalLink className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {embedUrl && (
                        <>
                          <Badge variant="secondary">{detectProvider(embedUrl)}</Badge>
                          <span className="text-xs text-muted-foreground">Detected provider</span>
                        </>
                      )}
                      {!embedUrl && (
                        <p className="text-xs text-muted-foreground">
                          Supports YouTube, Vimeo, Loom, Figma, and other embeddable URLs
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Text Lesson Editor
// ============================================================================

interface TextLessonEditorProps {
  lessonId: Id<"lessons">;
  initialContent?: unknown;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function TextLessonEditor({ lessonId, initialContent }: TextLessonEditorProps): React.ReactElement {
  const updateContent = useMutation(api.lessons.updateContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Determine initial value for editor
  const initialValue: Value = React.useMemo(() => {
    if (initialContent && Array.isArray(initialContent) && initialContent.length > 0) {
      return initialContent as Value;
    }
    // Default empty paragraph
    return [{ type: "p", children: [{ text: "" }] }] as Value;
  }, [initialContent]);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // Debounced save handler
  const debouncedSave = useDebouncedCallback(
    async (value: Value) => {
      setSaveStatus("saving");
      try {
        await updateContent({
          lessonId,
          content: sanitizeEditorContent(value),
        });
        setSaveStatus("saved");

        // Reset to idle after a delay
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (error) {
        console.error("Failed to save lesson content:", error);
        setSaveStatus("error");
        toast.error("Failed to save lesson content");
      }
    },
    500,
    { maxWait: 2000 }
  );

  return (
    <Card className="rounded-2xl border-border py-0 gap-0 flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-4 rounded-t-2xl shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Content</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="size-3 text-green-600" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <X className="size-3 text-red-500" />
              <span>Save failed</span>
            </>
          )}
        </div>
      </div>
      <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        <Plate
          editor={editor}
          onChange={({ value }) => {
            debouncedSave(value);
          }}
        >
          <EditorContainer className="flex-1 overflow-auto">
            <Editor placeholder="Start writing your lesson content..." />
          </EditorContainer>
        </Plate>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Embed Lesson Editor
// ============================================================================

interface EmbedLessonEditorProps {
  lessonId: Id<"lessons">;
  initialContent?: unknown;
}

function EmbedLessonEditor({ lessonId, initialContent }: EmbedLessonEditorProps): React.ReactElement {
  const updateContent = useMutation(api.lessons.updateContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Determine initial value for editor
  const initialValue: Value = React.useMemo(() => {
    if (initialContent && Array.isArray(initialContent) && initialContent.length > 0) {
      return initialContent as Value;
    }
    // Default empty paragraph
    return [{ type: "p", children: [{ text: "" }] }] as Value;
  }, [initialContent]);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // Debounced save handler
  const debouncedSave = useDebouncedCallback(
    async (value: Value) => {
      setSaveStatus("saving");
      try {
        await updateContent({
          lessonId,
          content: sanitizeEditorContent(value),
        });
        setSaveStatus("saved");

        // Reset to idle after a delay
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (error) {
        console.error("Failed to save lesson content:", error);
        setSaveStatus("error");
        toast.error("Failed to save lesson content");
      }
    },
    500,
    { maxWait: 2000 }
  );

  return (
    <Card className="rounded-2xl border-border py-0 gap-0 flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-4 rounded-t-2xl shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Additional Content</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="size-3 text-green-600" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <X className="size-3 text-red-500" />
              <span>Save failed</span>
            </>
          )}
        </div>
      </div>
      <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        <Plate
          editor={editor}
          onChange={({ value }) => {
            debouncedSave(value);
          }}
        >
          <EditorContainer className="flex-1 overflow-auto">
            <Editor placeholder="Add notes, instructions, or additional context for this video..." />
          </EditorContainer>
        </Plate>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Quiz Lesson Editor
// ============================================================================

interface QuizLessonEditorProps {
  lessonId: Id<"lessons">;
  quizConfig?: {
    passingScore: number;
    allowRetry: boolean;
    maxAttempts?: number;
    showAnswers: boolean;
    questions: Array<{
      _id: Id<"quizQuestions">;
      questionText: string;
      options: Array<{ text: string; isCorrect: boolean }>;
      explanation?: string;
      points: number;
      displayOrder: number;
    }>;
  };
}

function QuizLessonEditor({ lessonId, quizConfig }: QuizLessonEditorProps) {
  // Questions from props (included in lessons.get response)
  const questions = quizConfig?.questions ?? [];

  // New question state
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptions, setNewOptions] = useState([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [newExplanation, setNewExplanation] = useState("");
  const [newPoints, setNewPoints] = useState("1");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // Edit question state
  const [editingQuestionId, setEditingQuestionId] = useState<Id<"quizQuestions"> | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editOptions, setEditOptions] = useState<Array<{ text: string; isCorrect: boolean }>>([]);
  const [editExplanation, setEditExplanation] = useState("");
  const [editPoints, setEditPoints] = useState("1");
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  const addQuestion = useMutation(api.lessons.addQuestion);
  const updateQuestion = useMutation(api.lessons.updateQuestion);
  const removeQuestion = useMutation(api.lessons.removeQuestion);

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) {
      toast.error("Please enter a question");
      return;
    }

    const validOptions = newOptions.filter((o) => o.text.trim());
    if (validOptions.length < 2) {
      toast.error("Please add at least 2 options");
      return;
    }

    if (!validOptions.some((o) => o.isCorrect)) {
      toast.error("Please mark at least one option as correct");
      return;
    }

    setIsAddingQuestion(true);
    try {
      await addQuestion({
        lessonId,
        questionText: newQuestionText.trim(),
        options: validOptions.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
        explanation: newExplanation.trim() || undefined,
        points: parseInt(newPoints) || 1,
      });

      // Reset form
      setNewQuestionText("");
      setNewOptions([
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
      setNewExplanation("");
      setNewPoints("1");
      setShowNewQuestion(false);
      toast.success("Question added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add question");
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: Id<"quizQuestions">) => {
    try {
      await removeQuestion({ questionId });
      toast.success("Question deleted");
    } catch (error) {
      toast.error("Failed to delete question");
    }
  };

  // Start editing a question
  const handleStartEdit = (question: typeof questions[0]) => {
    setEditingQuestionId(question._id);
    setEditQuestionText(question.questionText);
    setEditOptions([...question.options]);
    setEditExplanation(question.explanation || "");
    setEditPoints(question.points.toString());
    setShowNewQuestion(false); // Close new question form if open
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingQuestionId(null);
    setEditQuestionText("");
    setEditOptions([]);
    setEditExplanation("");
    setEditPoints("1");
  };

  // Save edited question
  const handleSaveEdit = async () => {
    if (!editingQuestionId) return;

    if (!editQuestionText.trim()) {
      toast.error("Please enter a question");
      return;
    }

    const validOptions = editOptions.filter((o) => o.text.trim());
    if (validOptions.length < 2) {
      toast.error("Please add at least 2 options");
      return;
    }

    if (!validOptions.some((o) => o.isCorrect)) {
      toast.error("Please mark at least one option as correct");
      return;
    }

    setIsSavingQuestion(true);
    try {
      await updateQuestion({
        questionId: editingQuestionId,
        questionText: editQuestionText.trim(),
        options: validOptions.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
        explanation: editExplanation.trim() || undefined,
        points: parseInt(editPoints) || 1,
      });
      handleCancelEdit();
      toast.success("Question updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update question");
    } finally {
      setIsSavingQuestion(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border py-0 gap-0 shadow-sm flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-foreground">
            Questions ({questions.length})
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowNewQuestion(true)}>
            <Plus className="size-4" data-icon="inline-start" />
            Add Question
          </Button>
        </div>
        <ScrollArea className="h-0 flex-1">
        <CardContent className="pt-6 pb-6">
          {/* Existing Questions */}
          <div className="space-y-4">
            {questions
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((question, index) => (
                <div
                  key={question._id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  {/* Edit Mode */}
                  {editingQuestionId === question._id ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Edit Question {index + 1}</h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Question</Label>
                        <Textarea
                          value={editQuestionText}
                          onChange={(e) => setEditQuestionText(e.target.value)}
                          placeholder="Enter your question..."
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Options (check the correct ones)</Label>
                        {editOptions.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={option.isCorrect}
                              onChange={(e) => {
                                setEditOptions(editOptions.map((opt, i) =>
                                  i === optIndex ? { ...opt, isCorrect: e.target.checked } : opt
                                ));
                              }}
                              className="size-4"
                            />
                            <Input
                              value={option.text}
                              onChange={(e) => {
                                setEditOptions(editOptions.map((opt, i) =>
                                  i === optIndex ? { ...opt, text: e.target.value } : opt
                                ));
                              }}
                              placeholder={`Option ${optIndex + 1}`}
                              className="flex-1"
                            />
                            {editOptions.length > 2 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditOptions(editOptions.filter((_, i) => i !== optIndex));
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {editOptions.length < 6 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditOptions([...editOptions, { text: "", isCorrect: false }]);
                            }}
                          >
                            <Plus className="size-4" data-icon="inline-start" />
                            Add Option
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Points</Label>
                          <Input
                            type="number"
                            min="1"
                            value={editPoints}
                            onChange={(e) => setEditPoints(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Explanation (optional)</Label>
                          <Input
                            value={editExplanation}
                            onChange={(e) => setEditExplanation(e.target.value)}
                            placeholder="Why this answer is correct..."
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveEdit}
                          disabled={isSavingQuestion}
                          className="flex-1"
                        >
                          {isSavingQuestion ? (
                            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                          ) : (
                            <Save className="size-4" data-icon="inline-start" />
                          )}
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Q{index + 1}
                          </span>
                          <Badge variant="outline">{question.points} pts</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleStartEdit(question)}
                          >
                            <Pencil className="size-4 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                              <Trash2 className="size-4 text-red-500" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete question?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteQuestion(question._id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <p className="font-medium">{question.questionText}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {question.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className={`p-2 rounded text-sm ${
                              option.isCorrect
                                ? "bg-green-50 border border-green-200 text-green-700"
                                : "bg-muted/50 border"
                            }`}
                          >
                            {option.isCorrect && (
                              <Check className="size-3 inline mr-1" />
                            )}
                            {option.text}
                          </div>
                        ))}
                      </div>
                      {question.explanation && (
                        <p className="text-sm text-muted-foreground italic">
                          {question.explanation}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}

            {(!quizConfig?.questions || quizConfig.questions.length === 0) && !showNewQuestion && (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="size-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No questions yet</p>
                <Button
                  variant="link"
                  onClick={() => setShowNewQuestion(true)}
                  className="mt-2"
                >
                  Add your first question
                </Button>
              </div>
            )}
          </div>

          {/* New Question Form */}
          {showNewQuestion && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4 p-4 border-2 border-dashed rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">New Question</h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowNewQuestion(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Question</Label>
                  <Textarea
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Enter your question..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Options (check the correct one)</Label>
                  {newOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => {
                          setNewOptions(newOptions.map((opt, i) =>
                            i === index ? { ...opt, isCorrect: e.target.checked } : opt
                          ));
                        }}
                        className="size-4"
                      />
                      <Input
                        value={option.text}
                        onChange={(e) => {
                          setNewOptions(newOptions.map((opt, i) =>
                            i === index ? { ...opt, text: e.target.value } : opt
                          ));
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1"
                      />
                      {newOptions.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setNewOptions(newOptions.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {newOptions.length < 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewOptions([...newOptions, { text: "", isCorrect: false }]);
                      }}
                    >
                      <Plus className="size-4" data-icon="inline-start" />
                      Add Option
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Points</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newPoints}
                      onChange={(e) => setNewPoints(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Explanation (optional)</Label>
                    <Input
                      value={newExplanation}
                      onChange={(e) => setNewExplanation(e.target.value)}
                      placeholder="Why this answer is correct..."
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddQuestion}
                    disabled={isAddingQuestion}
                    className="flex-1"
                  >
                    {isAddingQuestion ? (
                      <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                    ) : (
                      <Plus className="size-4" data-icon="inline-start" />
                    )}
                    Add Question
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewQuestion(false)}
                    disabled={isAddingQuestion}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
        </ScrollArea>
    </Card>
  );
}

// ============================================================================
// Files Lesson Editor
// ============================================================================

interface FilesLessonEditorProps {
  lessonId: Id<"lessons">;
  initialContent?: unknown;
  files?: Array<{
    _id: Id<"files">;
    fileName: string;
    fileSize: number;
    fileType: string;
    downloadUrl: string;
  }>;
}

function FilesLessonEditor({ lessonId, initialContent, files }: FilesLessonEditorProps): React.ReactElement {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Mutations
  const updateContent = useMutation(api.lessons.updateContent);
  const saveAttachment = useMutation(api.files.saveAttachment);
  const removeAttachment = useMutation(api.files.removeAttachment);

  // Determine initial value for editor
  const initialValue: Value = React.useMemo(() => {
    if (initialContent && Array.isArray(initialContent) && initialContent.length > 0) {
      return initialContent as Value;
    }
    // Default empty paragraph
    return [{ type: "p", children: [{ text: "" }] }] as Value;
  }, [initialContent]);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // Debounced save handler
  const debouncedSave = useDebouncedCallback(
    async (value: Value) => {
      setSaveStatus("saving");
      try {
        await updateContent({
          lessonId,
          content: sanitizeEditorContent(value),
        });
        setSaveStatus("saved");

        // Reset to idle after a delay
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (error) {
        console.error("Failed to save lesson content:", error);
        setSaveStatus("error");
        toast.error("Failed to save lesson content");
      }
    },
    500,
    { maxWait: 2000 }
  );

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle file upload via UploadThing
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Convert FileList to array
      const filesArray = Array.from(selectedFiles);

      // Upload via UploadThing
      const uploadedFiles = await uploadFiles("editorUploader", {
        files: filesArray,
        onUploadProgress: ({ progress }) => {
          setUploadProgress(Math.min(progress, 100));
        },
      });

      // Save each uploaded file to Convex
      for (const file of uploadedFiles) {
        await saveAttachment({
          lessonId,
          downloadUrl: file.url, // UploadThing URL
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });
      }

      toast.success(
        uploadedFiles.length === 1
          ? "File uploaded"
          : `${uploadedFiles.length} files uploaded`
      );

      // Reset input
      event.target.value = "";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
      console.error(error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteFile = async (fileId: Id<"files">) => {
    try {
      await removeAttachment({ fileId });
      toast.success("File deleted");
    } catch (error) {
      toast.error("Failed to delete file");
      console.error(error);
    }
  };

  return (
    <Card className="rounded-2xl border-border py-0 gap-0 flex-1 flex flex-col min-h-0 overflow-hidden">
      <Tabs defaultValue="files" className="flex flex-col h-full">
        {/* Tab Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-3 rounded-t-2xl shrink-0">
          <TabsList className="bg-transparent h-auto p-0 gap-4">
            <TabsTrigger
              value="files"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none px-1 py-2 font-semibold text-sm"
            >
              Files {files && files.length > 0 && `(${files.length})`}
            </TabsTrigger>
            <TabsTrigger
              value="description"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none px-1 py-2 font-semibold text-sm"
            >
              Description & Instructions
            </TabsTrigger>
          </TabsList>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="size-3 animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="size-3 text-green-600" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <X className="size-3 text-red-500" />
                <span>Save failed</span>
              </>
            )}
          </div>
        </div>

        {/* Files Tab */}
        <TabsContent value="files" className="flex-1 flex flex-col m-0 min-h-0">
          {/* Upload Zone - Fixed */}
          <div className="px-6 py-6 border-b border-border shrink-0">
            <label className={`block p-8 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-muted/50 transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={isUploading}
                multiple
              />
              {isUploading ? (
                <>
                  <Loader2 className="size-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
                </>
              ) : (
                <>
                  <Plus className="size-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload files
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Word, Excel, PowerPoint, Images, Videos (max 50MB each)
                  </p>
                </>
              )}
            </label>
          </div>

          {/* File List - Scrollable */}
          <ScrollArea className="h-0 flex-1">
            <div className="px-6 py-4">
              {files && files.length > 0 ? (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file._id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)} · {file.fileType}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" render={<a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" />}>
                          <ExternalLink className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="text-red-500" />}>
                            <Trash2 className="size-4" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete file?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &quot;{file.fileName}&quot;.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteFile(file._id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No files uploaded yet
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Description Tab */}
        <TabsContent value="description" className="flex-1 flex flex-col m-0 min-h-0 overflow-hidden">
          <Plate
            editor={editor}
            onChange={({ value }) => {
              debouncedSave(value);
            }}
          >
            <EditorContainer className="flex-1 overflow-auto">
              <Editor placeholder="Add instructions on how to use these files, what learners should do with them..." />
            </EditorContainer>
          </Plate>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
