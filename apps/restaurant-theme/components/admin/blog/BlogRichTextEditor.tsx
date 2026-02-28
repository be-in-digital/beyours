"use client"

import { useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import CharacterCount from "@tiptap/extension-character-count"
import Image from "@tiptap/extension-image"
import { useEffect } from "react"
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Heading4,
  Quote,
  Minus,
  ImageIcon,
} from "lucide-react"
import { Button } from "@beindigital-engine/ui"
import { CmsMediaPicker } from "@/components/admin/cms/CmsMediaPicker"

interface BlogRichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
}

export function BlogRichTextEditor({
  value,
  onChange,
  placeholder = "Redigez votre article...",
  maxLength,
  disabled,
}: BlogRichTextEditorProps) {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        code: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "underline text-primary" },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({
        HTMLAttributes: { class: "rounded-md max-w-full" },
      }),
      ...(maxLength
        ? [CharacterCount.configure({ limit: maxLength })]
        : []),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  const charCount = editor.storage.characterCount?.characters?.() ?? 0

  const ToolbarButton = ({
    active,
    onClick,
    children,
    title,
  }: {
    active?: boolean
    onClick: () => void
    children: React.ReactNode
    title?: string
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-7 w-7 p-0 ${active ? "bg-muted" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  )

  return (
    <div className="rounded-md border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
        {/* Text formatting */}
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("URL du lien :")
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            } else {
              editor.chain().focus().unsetLink().run()
            }
          }}
          title="Lien"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Headings */}
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titre H2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Titre H3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 4 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          title="Titre H4"
        >
          <Heading4 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste a puces"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numerotee"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Block elements */}
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citation"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Separateur"
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setMediaPickerOpen(true)}
          title="Inserer une image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        {maxLength && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {charCount}/{maxLength}
          </span>
        )}
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 min-h-[200px] focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />

      {/* Media Picker for inline images */}
      <CmsMediaPicker
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        kindFilter="image"
        onSelect={(media) => {
          editor.chain().focus().setImage({ src: media.url, alt: media.filename }).run()
          setMediaPickerOpen(false)
        }}
      />
    </div>
  )
}
