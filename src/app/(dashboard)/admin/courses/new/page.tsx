"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createCourse = useMutation(api.courses.create);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a course title");
      return;
    }

    setIsCreating(true);
    try {
      const courseId = await createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Course created");
      router.push(`/admin/courses/${courseId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create course");
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/admin/courses" />}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">New Course</h1>
      </div>

      {/* Form */}
      <div className="space-y-6 rounded-lg border p-6">
        <div className="space-y-2">
          <Label htmlFor="title">Course Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., BDR Fundamentals"
            autoFocus
          />
          <p className="text-sm text-muted-foreground">
            Choose a clear, descriptive title (3-200 characters)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will learners gain from this course?"
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" render={<Link href="/admin/courses" />}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !title.trim()}>
            {isCreating ? "Creating..." : "Create Course"}
          </Button>
        </div>
      </div>
    </div>
  );
}
