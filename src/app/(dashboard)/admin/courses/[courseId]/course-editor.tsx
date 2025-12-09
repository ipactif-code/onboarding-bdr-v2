"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Globe,
  GlobeLock,
  Trash2,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  FileText,
  Video,
  HelpCircle,
  FileIcon,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Course {
  _id: Id<"courses">;
  title: string;
  description?: string;
  coverImageUrl?: string;
  creator: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  };
  status: "draft" | "published";
  visibility: "all_teams" | "specific_teams" | "specific_users";
  displayOrder: number;
  viewCount: number;
  tags: Array<{ _id: Id<"tags">; name: string }>;
  sections: Array<{
    _id: Id<"sections">;
    title: string;
    description?: string;
    displayOrder: number;
    lessons: Array<{
      _id: Id<"lessons">;
      title: string;
      type: "text" | "embed" | "quiz" | "files";
      estimatedDuration?: number;
      displayOrder: number;
    }>;
  }>;
  publishedAt?: number;
  _creationTime: number;
}

interface CourseEditorProps {
  course: Course;
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

export function CourseEditor({ course: initialCourse }: CourseEditorProps) {
  const router = useRouter();

  // Local state for form fields
  const [title, setTitle] = useState(initialCourse.title);
  const [description, setDescription] = useState(initialCourse.description ?? "");
  const [visibility, setVisibility] = useState(initialCourse.visibility);
  const [isSaving, setIsSaving] = useState(false);

  // Section/Lesson dialogs
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newLessonSectionId, setNewLessonSectionId] = useState<Id<"sections"> | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState<"text" | "embed" | "quiz" | "files">("text");

  // Fetch fresh course data
  const course = useQuery(api.courses.get, { courseId: initialCourse._id }) ?? initialCourse;

  // Mutations
  const updateCourse = useMutation(api.courses.update);
  const publishCourse = useMutation(api.courses.publish);
  const unpublishCourse = useMutation(api.courses.unpublish);
  const removeCourse = useMutation(api.courses.remove);
  const createSection = useMutation(api.sections.create);
  const updateSection = useMutation(api.sections.update);
  const removeSection = useMutation(api.sections.remove);
  const reorderSections = useMutation(api.sections.reorder);
  const createLesson = useMutation(api.lessons.create);
  const removeLesson = useMutation(api.lessons.remove);
  const reorderLessons = useMutation(api.lessons.reorder);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Save course details
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCourse({
        courseId: course._id,
        title,
        description: description || undefined,
        visibility,
      });
      toast.success("Course saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save course");
    } finally {
      setIsSaving(false);
    }
  };

  // Publish/Unpublish
  const handlePublish = async () => {
    try {
      await publishCourse({ courseId: course._id });
      toast.success("Course published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish course");
    }
  };

  const handleUnpublish = async () => {
    try {
      await unpublishCourse({ courseId: course._id });
      toast.success("Course unpublished");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unpublish course");
    }
  };

  // Delete course
  const handleDelete = async () => {
    try {
      await removeCourse({ courseId: course._id });
      toast.success("Course deleted");
      router.push("/admin/courses");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete course");
    }
  };

  // Create section
  const handleCreateSection = async () => {
    if (!newSectionTitle.trim()) return;
    try {
      await createSection({
        courseId: course._id,
        title: newSectionTitle.trim(),
      });
      setNewSectionTitle("");
      setNewSectionOpen(false);
      toast.success("Section created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create section");
    }
  };

  // Create lesson
  const handleCreateLesson = async () => {
    if (!newLessonSectionId || !newLessonTitle.trim()) return;
    try {
      const lessonId = await createLesson({
        sectionId: newLessonSectionId,
        type: newLessonType,
        title: newLessonTitle.trim(),
      });
      setNewLessonTitle("");
      setNewLessonSectionId(null);
      toast.success("Lesson created");
      // Navigate to lesson editor
      router.push(`/admin/courses/${course._id}/lessons/${lessonId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create lesson");
    }
  };

  // Section reorder
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = course.sections.findIndex((s) => s._id === active.id);
    const newIndex = course.sections.findIndex((s) => s._id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newSections = arrayMove(course.sections, oldIndex, newIndex);
      const sectionOrders = newSections.map((s, i) => ({
        sectionId: s._id,
        displayOrder: i + 1,
      }));
      reorderSections({ courseId: course._id, sectionOrders });
    }
  };

  // Lesson reorder within section
  const handleLessonDragEnd = (sectionId: Id<"sections">, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const section = course.sections.find((s) => s._id === sectionId);
    if (!section) return;

    const oldIndex = section.lessons.findIndex((l) => l._id === active.id);
    const newIndex = section.lessons.findIndex((l) => l._id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newLessons = arrayMove(section.lessons, oldIndex, newIndex);
      const lessonOrders = newLessons.map((l, i) => ({
        lessonId: l._id,
        displayOrder: i + 1,
      }));
      reorderLessons({ sectionId, lessonOrders });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/courses">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-950">{course.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className={
                  course.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-neutral-100 text-neutral-800"
                }
              >
                {course.status === "published" ? "Published" : "Draft"}
              </Badge>
              <span className="text-sm text-neutral-500">
                {course.sections.length} sections ·{" "}
                {course.sections.reduce((sum, s) => sum + s.lessons.length, 0)} lessons
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {course.status === "published" ? (
            <Button variant="outline" onClick={handleUnpublish}>
              <GlobeLock className="size-4 mr-2" />
              Unpublish
            </Button>
          ) : (
            <Button variant="outline" onClick={handlePublish}>
              <Globe className="size-4 mr-2" />
              Publish
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="size-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete course?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{course.title}&quot; and all its
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
        </div>
      </div>

      <Separator />

      {/* Course Details Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Description */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Course title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Course description"
                rows={4}
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Sections</h2>
              <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="size-4 mr-2" />
                    Add Section
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Section</DialogTitle>
                    <DialogDescription>
                      Create a new section to organize your lessons.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="section-title">Section Title</Label>
                      <Input
                        id="section-title"
                        value={newSectionTitle}
                        onChange={(e) => setNewSectionTitle(e.target.value)}
                        placeholder="e.g., Introduction"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewSectionOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateSection} disabled={!newSectionTitle.trim()}>
                      Create Section
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Sortable Sections */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd}
            >
              <SortableContext
                items={course.sections.map((s) => s._id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {course.sections
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((section) => (
                      <SortableSection
                        key={section._id}
                        section={section}
                        courseId={course._id}
                        sensors={sensors}
                        onLessonDragEnd={handleLessonDragEnd}
                        onAddLesson={() => setNewLessonSectionId(section._id)}
                        onUpdateSection={updateSection}
                        onDeleteSection={removeSection}
                        onDeleteLesson={removeLesson}
                      />
                    ))}
                </div>
              </SortableContext>
            </DndContext>

            {course.sections.length === 0 && (
              <div className="text-center py-8 border border-dashed rounded-lg">
                <p className="text-neutral-500">No sections yet</p>
                <Button
                  variant="link"
                  onClick={() => setNewSectionOpen(true)}
                  className="mt-2"
                >
                  Create your first section
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Settings */}
        <div className="space-y-6">
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium">Settings</h3>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) =>
                  setVisibility(v as "all_teams" | "specific_teams" | "specific_users")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_teams">All Teams</SelectItem>
                  <SelectItem value="specific_teams">Specific Teams</SelectItem>
                  <SelectItem value="specific_users">Specific Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* New Lesson Dialog */}
      <Dialog
        open={!!newLessonSectionId}
        onOpenChange={(open) => !open && setNewLessonSectionId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Lesson</DialogTitle>
            <DialogDescription>Add a new lesson to this section.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lesson-title">Lesson Title</Label>
              <Input
                id="lesson-title"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="e.g., Getting Started"
              />
            </div>
            <div className="space-y-2">
              <Label>Lesson Type</Label>
              <Select
                value={newLessonType}
                onValueChange={(v) =>
                  setNewLessonType(v as "text" | "embed" | "quiz" | "files")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4" />
                      Text Lesson
                    </div>
                  </SelectItem>
                  <SelectItem value="embed">
                    <div className="flex items-center gap-2">
                      <Video className="size-4" />
                      Video/Embed
                    </div>
                  </SelectItem>
                  <SelectItem value="quiz">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="size-4" />
                      Quiz
                    </div>
                  </SelectItem>
                  <SelectItem value="files">
                    <div className="flex items-center gap-2">
                      <FileIcon className="size-4" />
                      Files
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLessonSectionId(null)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLesson} disabled={!newLessonTitle.trim()}>
              Create Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sortable Section Component
interface SortableSectionProps {
  section: Course["sections"][number];
  courseId: Id<"courses">;
  sensors: ReturnType<typeof useSensors>;
  onLessonDragEnd: (sectionId: Id<"sections">, event: DragEndEvent) => void;
  onAddLesson: () => void;
  onUpdateSection: (args: { sectionId: Id<"sections">; title?: string }) => void;
  onDeleteSection: (args: { sectionId: Id<"sections"> }) => void;
  onDeleteLesson: (args: { lessonId: Id<"lessons"> }) => void;
}

function SortableSection({
  section,
  courseId,
  sensors,
  onLessonDragEnd,
  onAddLesson,
  onUpdateSection,
  onDeleteSection,
  onDeleteLesson,
}: SortableSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== section.title) {
      onUpdateSection({ sectionId: section._id, title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-t-lg border-b">
          <button
            className="cursor-grab hover:bg-neutral-200 rounded p-1"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4 text-neutral-400" />
          </button>

          <CollapsibleTrigger asChild>
            <button className="p-1 hover:bg-neutral-200 rounded">
              {isOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          </CollapsibleTrigger>

          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              className="h-8 flex-1"
              autoFocus
            />
          ) : (
            <span className="font-medium flex-1">{section.title}</span>
          )}

          <span className="text-sm text-neutral-500">
            {section.lessons.length} lesson{section.lessons.length !== 1 && "s"}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="size-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddLesson}>
                <Plus className="size-4 mr-2" />
                Add Lesson
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete section?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{section.title}&quot; and all
                      its lessons. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteSection({ sectionId: section._id })}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CollapsibleContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => onLessonDragEnd(section._id, e)}
          >
            <SortableContext
              items={section.lessons.map((l) => l._id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="p-2 space-y-1">
                {section.lessons
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((lesson) => (
                    <SortableLesson
                      key={lesson._id}
                      lesson={lesson}
                      courseId={courseId}
                      onDelete={() => onDeleteLesson({ lessonId: lesson._id })}
                    />
                  ))}

                {section.lessons.length === 0 && (
                  <div className="text-center py-4 text-sm text-neutral-500">
                    No lessons yet.{" "}
                    <button
                      onClick={onAddLesson}
                      className="text-blue-600 hover:underline"
                    >
                      Add one
                    </button>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Sortable Lesson Component
interface SortableLessonProps {
  lesson: Course["sections"][number]["lessons"][number];
  courseId: Id<"courses">;
  onDelete: () => void;
}

function SortableLesson({ lesson, courseId, onDelete }: SortableLessonProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = lessonTypeIcons[lesson.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded hover:bg-neutral-50 group"
    >
      <button
        className="cursor-grab hover:bg-neutral-200 rounded p-1 opacity-0 group-hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4 text-neutral-400" />
      </button>

      <Icon className="size-4 text-neutral-500" />

      <Link
        href={`/admin/courses/${courseId}/lessons/${lesson._id}`}
        className="flex-1 text-sm hover:text-blue-600"
      >
        {lesson.title}
      </Link>

      <Badge variant="secondary" className="text-xs">
        {lessonTypeLabels[lesson.type]}
      </Badge>

      {lesson.estimatedDuration && (
        <span className="text-xs text-neutral-500">{lesson.estimatedDuration} min</span>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="size-3.5 text-red-500" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{lesson.title}&quot;. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
