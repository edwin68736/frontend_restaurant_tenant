import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import type { ReactNode, MouseEvent } from 'react'
import { REST_PORTAL_MODAL_STACK_Z, REST_PORTAL_MODAL_Z } from '@/utils/restaurantUiLayers'
import { FIXED_OVERLAY_SAFE, FIXED_OVERLAY_SHEET, MAX_H_MODAL_PANEL } from '@/utils/safeAreaClasses'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  overlayClassName?: string
  /** Capa superior (p. ej. sobre modal de cobro). */
  stacked?: boolean
}

/** Modal en document.body — evita recorte por overflow del layout restaurante. */
export function PortalModal({
  open,
  onClose,
  children,
  className = '',
  overlayClassName = '',
  stacked = false,
}: Props) {
  if (!open || typeof document === 'undefined') return null

  const zLayer = stacked ? REST_PORTAL_MODAL_STACK_Z : REST_PORTAL_MODAL_Z
  const isSheet = /\bitems-end\b/.test(overlayClassName)
  const overlayPaddingClass = isSheet ? FIXED_OVERLAY_SHEET : FIXED_OVERLAY_SAFE

  return createPortal(
    <div
      className={clsx(
        `fixed inset-0 ${zLayer} flex justify-center overflow-y-auto overscroll-contain bg-black/50`,
        overlayPaddingClass,
        overlayClassName?.includes('items-') ? null : 'items-start sm:items-center min-h-full',
        overlayClassName,
      )}
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={clsx(
          'my-auto flex w-full min-h-0 flex-col',
          MAX_H_MODAL_PANEL,
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
