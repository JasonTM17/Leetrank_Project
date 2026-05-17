import { cn } from "@/lib/utils";

interface AvatarProps {
  username: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-3xl",
};

// Stable color rotation keyed off the first letter of the username so the
// same user gets the same gradient on every render. Five hand-picked stops
// keep contrast against both light and dark themes.
const GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
];

function gradientFor(username: string): string {
  const i = username.length === 0 ? 0 : username.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[i];
}

export function Avatar({ username, src, size = "md", className }: AvatarProps) {
  const sized = cn("inline-flex items-center justify-center rounded-full font-semibold shrink-0", SIZE_CLASS[size]);

  if (src) {
    return (
      // Plain <img> on purpose — avatars come from arbitrary user-provided
      // URLs, not the configured next/image domains. The cost of the loader
      // workaround would exceed the value here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${username}'s avatar`}
        className={cn(sized, "object-cover bg-muted", className)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(sized, "bg-gradient-to-br text-white", gradientFor(username), className)}
      aria-label={`${username}'s avatar`}
      role="img"
    >
      {(username[0] ?? "?").toUpperCase()}
    </div>
  );
}
