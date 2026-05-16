import { ImagePlus, Paperclip, X } from 'lucide-react'
import type { ReactElement } from 'react'
import type { ImageAttachment } from '@shared/types/post'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { ComposerToolbarRow } from './ComposerToolbarRow'

interface ComposerImageStripProps {
  images: ImageAttachment[]
  onAttachImage: () => void
  onOpenImageGenerator: () => void
  onPreviewImage: (image: ImageAttachment) => void
  onRemoveImage: (localPath: string) => void
}

export function ComposerImageStrip({
  images,
  onAttachImage,
  onOpenImageGenerator,
  onPreviewImage,
  onRemoveImage
}: ComposerImageStripProps): ReactElement {
  return (
    <ComposerToolbarRow label="Media">
      <div className="composer-image-list">
        {images.map((image) => (
          <div key={image.localPath} className="composer-image-thumb">
            <button
              className="composer-image-preview"
              onClick={() => onPreviewImage(image)}
              aria-label="Preview image"
            >
              <img src={image.dataUrl ?? `file://${image.localPath}`} alt="" />
            </button>
            <IconButton
              label="Remove image"
              icon={<X size={10} />}
              className="composer-image-remove"
              onClick={() => onRemoveImage(image.localPath)}
            />
          </div>
        ))}
        {images.length < 4 ? (
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Paperclip size={13} />}
              onClick={onAttachImage}
            >
              Attach
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ImagePlus size={13} />}
              onClick={onOpenImageGenerator}
            >
              Generate
            </Button>
          </>
        ) : null}
      </div>
    </ComposerToolbarRow>
  )
}
