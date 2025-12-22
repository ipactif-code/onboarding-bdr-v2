# Forms Reference

## Table of Contents

1. [Setup & Imports](#setup--imports)
2. [Basic Form Pattern](#basic-form-pattern)
3. [Field Types](#field-types)
4. [Validation Patterns](#validation-patterns)
5. [Form with Mutation](#form-with-mutation)
6. [Complex Forms](#complex-forms)

## Setup & Imports

### Standard Form Imports

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
```

### Validator File Structure

```typescript
// src/lib/validators/course.ts
import { z } from "zod";

export const createCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.coerce.number().min(0, "Price must be positive"),
  isPublished: z.boolean().default(false),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = createCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
```

## Basic Form Pattern

### Complete Form Example

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { createCourseSchema, type CreateCourseInput } from "@/lib/validators/course";

export function CreateCourseForm() {
  const router = useRouter();
  const createCourse = useMutation(api.courses.create);
  
  const form = useForm<CreateCourseInput>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      isPublished: false,
    },
  });
  
  const { isSubmitting } = form.formState;
  
  const onSubmit = async (data: CreateCourseInput) => {
    try {
      const courseId = await createCourse(data);
      toast.success("Course created successfully");
      router.push(`/courses/${courseId}`);
    } catch (error) {
      toast.error("Failed to create course");
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Course title" {...field} />
              </FormControl>
              <FormDescription>
                The name of your course as it will appear to students.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe your course..."
                  className="min-h-32"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Course
        </Button>
      </form>
    </Form>
  );
}
```

## Field Types

### Text Input

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input type="email" placeholder="email@example.com" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Number Input

```tsx
<FormField
  control={form.control}
  name="price"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Price</FormLabel>
      <FormControl>
        <Input 
          type="number" 
          placeholder="0.00"
          {...field}
          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Select

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

<FormField
  control={form.control}
  name="category"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Category</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="development">Development</SelectItem>
          <SelectItem value="design">Design</SelectItem>
          <SelectItem value="marketing">Marketing</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Checkbox

```tsx
import { Checkbox } from "@/components/ui/checkbox";

<FormField
  control={form.control}
  name="isPublished"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>Published</FormLabel>
        <FormDescription>
          Make this course visible to students.
        </FormDescription>
      </div>
    </FormItem>
  )}
/>
```

### Switch

```tsx
import { Switch } from "@/components/ui/switch";

<FormField
  control={form.control}
  name="notifications"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <FormLabel className="text-base">Email Notifications</FormLabel>
        <FormDescription>
          Receive emails about course updates.
        </FormDescription>
      </div>
      <FormControl>
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
    </FormItem>
  )}
/>
```

### Date Picker

```tsx
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

<FormField
  control={form.control}
  name="startDate"
  render={({ field }) => (
    <FormItem className="flex flex-col">
      <FormLabel>Start Date</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] pl-3 text-left font-normal",
                !field.value && "text-muted-foreground"
              )}
            >
              {field.value ? format(field.value, "PPP") : "Pick a date"}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={field.value}
            onSelect={field.onChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Validation Patterns

### Common Zod Patterns

```typescript
import { z } from "zod";

// String validations
const stringSchema = z.object({
  required: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  url: z.string().url("Invalid URL"),
  minLength: z.string().min(3, "At least 3 characters"),
  maxLength: z.string().max(100, "Maximum 100 characters"),
  regex: z.string().regex(/^[A-Z]/, "Must start with uppercase"),
});

// Number validations
const numberSchema = z.object({
  required: z.coerce.number(), // Coerces string to number
  positive: z.coerce.number().positive("Must be positive"),
  range: z.coerce.number().min(0).max(100, "Must be 0-100"),
  integer: z.coerce.number().int("Must be a whole number"),
});

// Optional and nullable
const optionalSchema = z.object({
  optional: z.string().optional(), // undefined allowed
  nullable: z.string().nullable(), // null allowed
  nullish: z.string().nullish(), // null or undefined
  default: z.string().default("default value"),
});

// Arrays
const arraySchema = z.object({
  tags: z.array(z.string()).min(1, "At least one tag required"),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
  })),
});

// Enums
const enumSchema = z.object({
  status: z.enum(["draft", "published", "archived"]),
  role: z.enum(["admin", "user", "guest"]).default("user"),
});

// Conditional validation
const conditionalSchema = z.object({
  type: z.enum(["free", "paid"]),
  price: z.coerce.number(),
}).refine(
  (data) => data.type === "free" || data.price > 0,
  { message: "Paid courses must have a price", path: ["price"] }
);
```

## Form with Mutation

### Edit Form with Initial Data

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel";

import { updateCourseSchema, type UpdateCourseInput } from "@/lib/validators/course";

interface EditCourseFormProps {
  course: Doc<"courses">;
}

export function EditCourseForm({ course }: EditCourseFormProps) {
  const updateCourse = useMutation(api.courses.update);
  
  const form = useForm<UpdateCourseInput>({
    resolver: zodResolver(updateCourseSchema),
    defaultValues: {
      title: course.title,
      description: course.description,
      price: course.price,
      isPublished: course.isPublished,
    },
  });
  
  const { isSubmitting, isDirty } = form.formState;
  
  const onSubmit = async (data: UpdateCourseInput) => {
    try {
      await updateCourse({ id: course._id, ...data });
      toast.success("Course updated");
      form.reset(data); // Reset dirty state
    } catch (error) {
      toast.error("Failed to update course");
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Fields */}
        
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
          <Button 
            type="button" 
            variant="outline"
            onClick={() => form.reset()}
            disabled={!isDirty}
          >
            Reset
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

## Complex Forms

### Multi-Step Form

```tsx
"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const step1Schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
});

const step2Schema = z.object({
  price: z.coerce.number().min(0),
  category: z.string(),
});

const fullSchema = step1Schema.merge(step2Schema);
type FormData = z.infer<typeof fullSchema>;

export function MultiStepForm() {
  const [step, setStep] = useState(1);
  
  const form = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      category: "",
    },
  });
  
  const validateStep = async () => {
    const schema = step === 1 ? step1Schema : step2Schema;
    const fields = step === 1 
      ? ["title", "description"] as const
      : ["price", "category"] as const;
    
    const isValid = await form.trigger(fields);
    if (isValid) setStep(step + 1);
  };
  
  const onSubmit = async (data: FormData) => {
    // Submit logic
  };
  
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {step === 1 && <Step1Fields />}
        {step === 2 && <Step2Fields />}
        
        <div className="flex gap-4 mt-6">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" onClick={validateStep}>
              Next
            </Button>
          ) : (
            <Button type="submit">Submit</Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
```

### Form with Dynamic Fields

```tsx
"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";

const schema = z.object({
  lessons: z.array(z.object({
    title: z.string().min(1, "Title required"),
    duration: z.coerce.number().min(1, "Duration required"),
  })).min(1, "At least one lesson required"),
});

type FormData = z.infer<typeof schema>;

export function LessonsForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      lessons: [{ title: "", duration: 0 }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lessons",
  });
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-4 items-start">
            <FormField
              control={form.control}
              name={`lessons.${index}.title`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="Lesson title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name={`lessons.${index}.duration`}
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormControl>
                    <Input type="number" placeholder="Min" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ title: "", duration: 0 })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Lesson
        </Button>
        
        <Button type="submit">Save Lessons</Button>
      </form>
    </Form>
  );
}
```
