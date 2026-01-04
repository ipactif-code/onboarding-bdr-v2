"use client";

import { type ReactElement } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

interface ContinueWatchingItem {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  courseTitle: string;
  coverImage?: string;
  progress: number;
  timeLeft?: string;
}

interface ContinueWatchingProps {
  items: ContinueWatchingItem[];
}

export function ContinueWatching({ items }: ContinueWatchingProps): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Continue watching
        </h2>
        <Button variant="ghost" size="sm" render={<Link href="/courses" />}>
          View all
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link
            key={item.lessonId}
            href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
          >
            <Card className="group overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-muted">
                {item.coverImage ? (
                  <Image
                    src={item.coverImage}
                    alt={item.lessonTitle}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="size-12 rounded-full bg-background/90 flex items-center justify-center">
                    <Play className="size-6 text-foreground ml-1" />
                  </div>
                </div>

                {/* Progress bar at bottom */}
                <div className="absolute bottom-0 left-0 right-0">
                  <Progress value={item.progress} className="h-1 rounded-none" />
                </div>
              </div>

              <CardContent className="p-3">
                <h3 className="font-medium text-sm text-foreground line-clamp-1">
                  {item.lessonTitle}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {item.courseTitle}
                </p>
                {item.timeLeft && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.timeLeft} left
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
