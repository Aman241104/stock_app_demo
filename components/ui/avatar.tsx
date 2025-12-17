"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

/**
 * Renders a Radix Avatar root element with default avatar sizing and shape, allowing additional class names.
 *
 * @param className - Additional CSS class names merged with the component's default avatar classes
 * @returns The Avatar root JSX element
 */
function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders the avatar image element with default sizing and aspect ratio.
 *
 * @param className - Additional CSS classes to merge with the component's default image classes
 * @returns The avatar image element with default `aspect-square` and `size-full` classes plus any merged `className`
 */
function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

/**
 * Renders a styled Radix Avatar.Fallback used when the avatar image is unavailable.
 *
 * @param className - Additional CSS classes merged with the component's default fallback styles
 * @returns The rendered AvatarPrimitive.Fallback element with default fallback styling and any passed props
 */
function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }