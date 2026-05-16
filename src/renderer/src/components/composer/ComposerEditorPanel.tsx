import { AlertCircle } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Editor } from '@tiptap/react'
import type { ImageAttachment } from '@shared/types/post'
import type { Platform } from '@shared/types/platform'
import { TiptapEditor } from './TiptapEditor'
import { ComposerPlatformRail } from './ComposerPlatformRail'
import { ComposerImageStrip } from './ComposerImageStrip'

interface ComposerEditorPanelProps {
  selectedPlatforms: Platform[]
  activePlatform: Platform
  images: ImageAttachment[]
  error: string | null
  onTogglePlatform: (platform: Platform) => void
  onEditorChange: (text: string) => void
  onEditorRef: (editor: Editor | null) => void
  onAttachImage: () => void
  onOpenImageGenerator: () => void
  onPreviewImage: (image: ImageAttachment) => void
  onRemoveImage: (localPath: string) => void
}

export function ComposerEditorPanel({
  selectedPlatforms,
  activePlatform,
  images,
  error,
  onTogglePlatform,
  onEditorChange,
  onEditorRef,
  onAttachImage,
  onOpenImageGenerator,
  onPreviewImage,
  onRemoveImage
}: ComposerEditorPanelProps): ReactElement {
  return (
    <section className="composer-editor-panel">
      <ComposerPlatformRail
        selectedPlatforms={selectedPlatforms}
        activePlatform={activePlatform}
        onTogglePlatform={onTogglePlatform}
      />
      <ComposerImageStrip
        images={images}
        onAttachImage={onAttachImage}
        onOpenImageGenerator={onOpenImageGenerator}
        onPreviewImage={onPreviewImage}
        onRemoveImage={onRemoveImage}
      />
      <div className="composer-editor-scroll">
        <TiptapEditor onChange={onEditorChange} editorRef={onEditorRef} />
      </div>
      {error ? (
        <div className="composer-error" role="alert">
          <AlertCircle size={13} />
          {error}
        </div>
      ) : null}
    </section>
  )
}
