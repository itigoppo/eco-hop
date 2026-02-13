"use client"

import { cn } from "@/lib/utils/common"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import * as React from "react"
import { createContext, useContext, useState } from "react"

const CollapsibleContext = createContext<{ isOpen: boolean }>({ isOpen: false })

function Collapsible({
  defaultOpen,
  onOpenChange,
  open,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false)
  const isOpen = open ?? internalOpen

  const handleOpenChange = (newOpen: boolean) => {
    setInternalOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  return (
    <CollapsibleContext.Provider value={{ isOpen }}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        defaultOpen={defaultOpen}
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  const { isOpen } = useContext(CollapsibleContext)

  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn("flex w-full cursor-pointer items-center justify-between", className)}
      {...props}
    >
      <span>{children}</span>
      <span className="material-symbols-outlined text-xl leading-none">
        {isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
      </span>
    </CollapsiblePrimitive.CollapsibleTrigger>
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return <CollapsiblePrimitive.CollapsibleContent data-slot="collapsible-content" {...props} />
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
