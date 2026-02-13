"use client"

import { cn } from "@/lib/utils/common"
import { cva, type VariantProps } from "class-variance-authority"
import { ComponentPropsWithoutRef, forwardRef } from "react"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 gap-1",
  {
    compoundVariants: [
      // === Outline Variants ===
      {
        class: "text-teal-500 border-teal-500 bg-white hover:bg-teal-50",
        outline: true,
        variant: "primary",
      },
      {
        class: "text-lime-500 border-lime-500 bg-white hover:bg-lime-50",
        outline: true,
        variant: "secondary",
      },
      {
        class: "text-rose-500 border-rose-500 bg-white hover:bg-rose-50",
        outline: true,
        variant: "danger",
      },
      {
        class: "text-amber-500 border-amber-500 bg-white hover:bg-amber-50",
        outline: true,
        variant: "warning",
      },
      {
        class: "text-slate-500 border-slate-500 bg-white hover:bg-slate-100",
        outline: true,
        variant: "default",
      },
      {
        class: "border-transparent",
        outline: true,
        variant: "ghost",
      },

      // === Disabled Variants ===
      {
        class: "bg-teal-300 border-teal-500 text-white/70 hover:bg-teal-300",
        disabled: true,
        variant: "primary",
      },
      {
        class: "bg-lime-300 border-lime-500 text-white/70 hover:bg-lime-300",
        disabled: true,
        variant: "secondary",
      },
      {
        class: "bg-rose-300 border-rose-500 text-white/70 hover:bg-rose-300",
        disabled: true,
        variant: "danger",
      },
      {
        class: "bg-amber-300 border-amber-500 text-white/70 hover:bg-amber-300",
        disabled: true,
        variant: "warning",
      },
      {
        class: "bg-slate-300 border-slate-500 text-white/70 hover:bg-slate-300",
        disabled: true,
        variant: "default",
      },
      {
        class: "text-slate-300 hover:bg-transparent",
        disabled: true,
        variant: "ghost",
      },
    ],
    defaultVariants: {
      disabled: false,
      outline: false,
      size: "default",
      variant: "default",
    },
    variants: {
      disabled: {
        false: "cursor-pointer",
        true: "cursor-not-allowed opacity-50 border",
      },
      outline: {
        false: "border-transparent",
        true: "bg-transparent border",
      },
      size: {
        default: "h-10 px-4 py-2",
        icon: "h-10 w-10",
        lg: "h-11 rounded-md px-8",
        sm: "h-9 rounded-md px-3",
      },
      variant: {
        danger: "bg-rose-500 text-white hover:bg-rose-600",
        default: "bg-slate-500 text-white hover:bg-slate-600",
        ghost: "bg-transparent text-slate-700 hover:bg-slate-200",
        primary: "bg-teal-500 text-white hover:bg-teal-600",
        secondary: "bg-lime-500 text-white hover:bg-lime-600",
        warning: "bg-amber-500 text-white hover:bg-amber-600",
      },
    },
  }
)

export interface ButtonProps
  extends
    Omit<ComponentPropsWithoutRef<"button">, "disabled">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  outline?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, disabled, outline, size, variant, ...props }, ref) => {
    if (asChild) {
      return (
        <span className={cn(buttonVariants({ className, outline, size, variant }))} {...props} />
      )
    }

    return (
      <button
        className={cn(buttonVariants({ className, disabled, outline, size, variant }))}
        ref={ref}
        {...props}
        disabled={disabled || undefined}
        onClick={disabled ? undefined : props.onClick}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
