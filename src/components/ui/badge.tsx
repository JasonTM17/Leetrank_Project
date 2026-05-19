import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:   "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline:     "text-foreground",
        success:     "border-transparent bg-success/10 text-success border-success/20",
        warning:     "border-transparent bg-warning/10 text-warning border-warning/20",
        easy:        "border-transparent bg-easy/10 text-easy border-easy/20",
        medium:      "border-transparent bg-medium/10 text-medium border-medium/20",
        hard:        "border-transparent bg-hard/10 text-hard border-hard/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Renders a small colored dot before the label. Dot color inherits the
   *  variant's text color via `bg-current`. */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          data-slot="dot"
          aria-hidden="true"
          className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
