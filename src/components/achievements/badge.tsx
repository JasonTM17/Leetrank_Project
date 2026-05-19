"use client";

import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

export interface BadgeAchievement {
  id?: string;
  slug: string;
  title: string;
  description?: string;
  icon: string;
  category?: string;
  points: number;
  earned?: boolean;
  earnedAt?: string | Date | null;
  progress?: number;
  threshold?: number;
}

interface AchievementBadgeProps {
  achievement: BadgeAchievement;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
  className?: string;
}

const sizes = {
  sm: { wrap: "p-3", icon: "h-5 w-5", title: "text-sm", desc: "text-xs" },
  md: { wrap: "p-4", icon: "h-6 w-6", title: "text-base", desc: "text-xs" },
  lg: { wrap: "p-5", icon: "h-8 w-8", title: "text-lg", desc: "text-sm" },
};

/**
 * Achievement badge tile. Earned state: gradient ring + colour. Locked
 * state: muted greyscale + reduced opacity. Inherits the project UI
 * vocabulary (gradient-text, hover lift, shadow-glow on earned cards).
 */
export function AchievementBadge({
  achievement,
  size = "md",
  showDescription = true,
  className,
}: AchievementBadgeProps) {
  const earned = achievement.earned ?? false;
  const sz = sizes[size];
  // Lookup the lucide icon by name, fall back to Award when missing.
  const IconCmp =
    (Icons as unknown as Record<string, Icons.LucideIcon>)[achievement.icon] ??
    Icons.Award;

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all flex flex-col items-center text-center",
        sz.wrap,
        earned
          ? "border-amber-300/50 bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-pink-500/10 shadow-glow hover:-translate-y-0.5"
          : "border-border bg-card/40 opacity-60 hover:opacity-90 grayscale",
        className
      )}
      data-testid={`achievement-badge-${achievement.slug}`}
    >
      <div
        className={cn(
          "rounded-full p-3 mb-2",
          earned
            ? "bg-gradient-to-br from-amber-400 to-pink-500 text-white shadow-md"
            : "bg-muted text-muted-foreground"
        )}
      >
        <IconCmp className={sz.icon} aria-hidden />
      </div>
      <div className={cn("font-semibold", sz.title)}>
        {earned ? (
          <span className="gradient-text">{achievement.title}</span>
        ) : (
          achievement.title
        )}
      </div>
      {showDescription && achievement.description ? (
        <p className={cn("text-muted-foreground mt-1", sz.desc)}>
          {achievement.description}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
            earned
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-muted text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              earned ? "bg-amber-500" : "bg-muted-foreground/40"
            )}
            aria-hidden
          />
          {achievement.points} pts
        </span>
        {!earned &&
        achievement.progress != null &&
        achievement.threshold != null ? (
          <span className="text-muted-foreground">
            {achievement.progress} / {achievement.threshold}
          </span>
        ) : null}
      </div>
    </div>
  );
}
