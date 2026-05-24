import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import type { ReactNode, MouseEvent } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  overlayClassName?: string
}

/** Modal en document.body — evita recorte por overflow del layout restaurante. */
export function PortalModal({ open, onClose, children, className = '', overlayClassName = '' }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-[250] flex justify-center bg-black/50 p-3 sm:p-4',
        overlayClassName?.includes('items-') ? null : 'items-center',
        overlayClassName,
      )}
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`w-full max-h-[min(92dvh,900px)] ${className}`}>{children}</div>
    </div>,
    document.body,
  )
}
