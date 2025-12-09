"use client";

import Image from "next/image";

interface CourseCardProps {
  title: string;
  description?: string;
  coverImage?: string;
  progress?: number; // 0-100, only shown if provided
}

export function CourseCard({
  title,
  description,
  coverImage,
  progress,
}: CourseCardProps) {
  return (
    <div className="flex flex-col gap-3 w-[278px] group">
      {/* Cover Image */}
      <div className="h-[177px] relative rounded-xl overflow-hidden bg-neutral-100">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 group-hover:scale-105 transition-transform">
            <span className="text-4xl">📚</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        {/* Title */}
        <p className="text-sm font-semibold text-neutral-950 line-clamp-1">
          {title}
        </p>

        {/* Description */}
        {description && (
          <p className="text-xs text-neutral-500 leading-4 line-clamp-2">
            {description}
          </p>
        )}

        {/* Progress Bar (optional) */}
        {progress !== undefined && (
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 h-2 w-20 rounded-lg overflow-hidden">
              <div
                className="bg-green-600 opacity-80 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500">
              {progress}% complete
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
