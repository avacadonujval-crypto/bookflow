import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1.15rem] text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-black text-white hover:bg-neutral-800",
        secondary: "bg-neutral-100 text-black hover:bg-neutral-200",
        outline:
          "border border-neutral-300 bg-white text-black hover:border-black hover:bg-neutral-50",
        ghost: "text-black hover:bg-neutral-100",
        destructive:
          "border border-black bg-white text-black hover:bg-black hover:text-white",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-[1rem] px-4 text-xs",
        lg: "h-12 rounded-[1.25rem] px-7 text-[15px]",
        icon: "h-10 w-10 rounded-[1.1rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
