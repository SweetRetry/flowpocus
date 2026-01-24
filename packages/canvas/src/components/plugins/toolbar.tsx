"use client"

import { Button } from "@workspace/ui/components/button"
import { ImageIcon, Redo2Icon, Undo2Icon, VideoIcon } from "lucide-react"

interface ToolbarProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAddImageNode: () => void
  onAddVideoNode: () => void
}

/**
 * Canvas toolbar with undo/redo and node creation
 */
export function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddImageNode,
  onAddVideoNode,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
      >
        <Undo2Icon className="size-[18px]" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo (Ctrl+Shift+Z)"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2Icon className="size-[18px]" />
      </Button>

      <div className="mx-1 h-6 w-px bg-border" />

      <Button variant="ghost" size="sm" onClick={onAddImageNode} title="Add Image">
        <ImageIcon className="size-4" />
        Image
      </Button>

      <Button variant="ghost" size="sm" onClick={onAddVideoNode} title="Add Video">
        <VideoIcon className="size-4" />
        Video
      </Button>
    </div>
  )
}
