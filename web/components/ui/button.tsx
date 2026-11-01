"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { iconButtonClass, primaryButtonClass, secondaryButtonClass } from "./styles";

type ButtonProps = HTMLMotionProps<"button">;

const press = { whileTap: { scale: 0.97 }, transition: { duration: 0.15 } } as const;

/** Yellow pill, black bold text, 52px, full width. One per screen. */
export function PrimaryButton({ className, type = "button", ...props }: ButtonProps) {
  return <motion.button type={type} {...press} className={cn(primaryButtonClass, className)} {...props} />;
}

/** Glass pill with white text, for the less important action. */
export function SecondaryButton({ className, type = "button", ...props }: ButtonProps) {
  return <motion.button type={type} {...press} className={cn(secondaryButtonClass, className)} {...props} />;
}

/** 40px circular icon button. `label` is required for screen readers. */
export function IconButton({
  className,
  label,
  type = "button",
  ...props
}: ButtonProps & { label: string }) {
  return (
    <motion.button
      type={type}
      aria-label={label}
      {...press}
      className={cn(iconButtonClass, className)}
      {...props}
    />
  );
}
