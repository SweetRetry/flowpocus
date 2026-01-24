"use client"

import { useCallback, useState } from "react"
import Markdown from "react-markdown"
import { cn } from "../../../lib/utils"

interface TextContentProps {
  content: string
  onContentChange?: (content: string) => void
  variant?: "node" | "focus"
}

const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-primary underline hover:no-underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
}

export function TextContent({ content, onContentChange, variant = "node" }: TextContentProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)

  const isFocus = variant === "focus"

  const handleClick = useCallback(() => {
    setEditContent(content)
    setIsEditing(true)
  }, [content])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    onContentChange?.(editContent)
  }, [editContent, onContentChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        setIsEditing(false)
        setEditContent(content)
      }
    },
    [content]
  )

  if (isEditing) {
    return (
      <textarea
        className={cn(
          "nodrag nowheel h-full w-full resize-none bg-transparent text-foreground outline-none",
          isFocus ? "bg-card p-6" : "p-3"
        )}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    )
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert h-full w-full max-w-none cursor-text overflow-auto text-foreground",
        isFocus ? "bg-card p-6" : "p-3"
      )}
      onClick={handleClick}
    >
      <Markdown components={markdownComponents}>{content || "_Empty_"}</Markdown>
    </div>
  )
}
