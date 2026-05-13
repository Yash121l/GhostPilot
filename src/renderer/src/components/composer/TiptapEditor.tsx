import { type ReactElement, useCallback, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Wand2, ArrowDownToLine, Anchor, MousePointerClick, Loader2 } from 'lucide-react'
import { ipc, IPC_CHANNELS } from '../../lib/ipc'
import { AITask, ModelHint } from '@shared/types/ai'
import { nanoid } from 'nanoid'
import { useState } from 'react'

export interface TiptapEditorProps {
  placeholder?: string
  onChange?: (text: string) => void
  editorRef?: (editor: Editor | null) => void
}

type AIAction = 'rewrite' | 'shorten' | 'hook' | 'cta'

const AI_ACTIONS: { id: AIAction; label: string; icon: React.ElementType; prompt: (text: string) => string }[] = [
  {
    id: 'rewrite',
    label: 'Rewrite',
    icon: Wand2,
    prompt: (t) =>
      `Rewrite the following text to be clearer and more engaging. Keep the same core message and length. Return only the rewritten text:\n\n${t}`,
  },
  {
    id: 'shorten',
    label: 'Shorten',
    icon: ArrowDownToLine,
    prompt: (t) =>
      `Shorten the following text by 30–40% while preserving all key ideas. Return only the shortened text:\n\n${t}`,
  },
  {
    id: 'hook',
    label: 'Add Hook',
    icon: Anchor,
    prompt: (t) =>
      `Add a compelling opening hook sentence to the beginning of this text. The hook should create curiosity or state a bold claim. Return the complete text with the hook prepended:\n\n${t}`,
  },
  {
    id: 'cta',
    label: 'Add CTA',
    icon: MousePointerClick,
    prompt: (t) =>
      `Add a natural call-to-action at the end of this text. The CTA should feel like a genuine invitation, not a sales pitch. Return the complete text with the CTA appended:\n\n${t}`,
  },
]

export function TiptapEditor({ placeholder, onChange, editorRef }: TiptapEditorProps): ReactElement {
  const [actionLoading, setActionLoading] = useState<AIAction | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({
        placeholder:
          placeholder ??
          'Write your post — a rough idea, full draft, or anything in between. AI will adapt it for each platform…',
      }),
    ],
    content: '',
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getText())
    },
    editorProps: {
      attributes: {
        class: 'min-h-[180px] focus:outline-none leading-relaxed text-sm tiptap user-select-text',
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef?.(e)
    },
    onDestroy: () => {
      editorRef?.(null)
    },
  })

  const handleAIAction = useCallback(
    async (action: AIAction): Promise<void> => {
      if (!editor) return

      // Get selected text, or full content if nothing selected
      const { from, to, empty } = editor.state.selection
      const selected = empty
        ? editor.getText()
        : editor.state.doc.textBetween(from, to, ' ')

      if (!selected.trim()) return

      setActionLoading(action)
      try {
        const actionDef = AI_ACTIONS.find((a) => a.id === action)!
        const res = await ipc.invoke(IPC_CHANNELS.AI_COMPLETE, {
          task: AITask.DRAFT_POST,
          hint: ModelHint.ECONOMY,
          prompt: actionDef.prompt(selected),
          maxTokens: 600,
          traceId: nanoid(),
        })

        if (!res.ok) return

        const newText = res.value.text.trim()
        if (empty) {
          // Replace all content
          editor.commands.setContent(newText)
        } else {
          // Replace selection
          editor.chain().focus().deleteSelection().insertContent(newText).run()
        }
      } finally {
        setActionLoading(null)
      }
    },
    [editor],
  )

  return (
    <div className="relative flex flex-col h-full">
      {/* AI Action Toolbar */}
      <div
        ref={toolbarRef}
        className="flex items-center gap-1 px-4 py-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mr-2">AI</span>
        {AI_ACTIONS.map((action) => {
          const Icon = action.icon
          const loading = actionLoading === action.id
          return (
            <button
              key={action.id}
              onClick={() => handleAIAction(action.id)}
              disabled={loading || actionLoading !== null}
              className="btn btn-ghost btn-sm flex items-center gap-1.5"
              style={{ fontSize: 11, padding: '3px 8px' }}
              title={action.label}
            >
              {loading ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Icon size={10} />
              )}
              {action.label}
            </button>
          )
        })}
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto py-5" style={{ paddingLeft: 28, paddingRight: 28 }}>
        <EditorContent editor={editor} />
      </div>

      {/* Character count */}
      {editor && (
        <div
          className="flex items-center justify-end px-5 py-2 text-[10px] text-[var(--color-text-muted)]"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <span className="font-mono">{editor.storage.characterCount?.characters?.() ?? 0} chars</span>
        </div>
      )}
    </div>
  )
}
