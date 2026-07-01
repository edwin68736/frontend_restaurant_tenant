import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { readSafeInsets } from '@/utils/safeAreaInsets'

type Props = {
  menuId: string
  openId: string | null
  onOpenChange: (id: string | null) => void
  trigger: ReactNode
  triggerClassName?: string
  children: ReactNode
  menuWidth?: number
  align?: 'left' | 'right'
}

const TRIGGER_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50'

/** Menú anclado al trigger vía portal; cierra al clic fuera o al elegir acción. */
export function AnchoredDropdown({
  menuId,
  openId,
  onOpenChange,
  trigger,
  triggerClassName = TRIGGER_CLASS,
  children,
  menuWidth = 208,
  align = 'right',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const open = openId === menuId
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    const update = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const { left: safeLeft, right: safeRight } = readSafeInsets()
      const edge = 8
      const left =
        align === 'right'
          ? Math.max(
              safeLeft + edge,
              Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - safeRight - edge),
            )
          : Math.max(safeLeft + edge, Math.min(rect.left, window.innerWidth - menuWidth - safeRight - edge))
      setMenuPos({ top: rect.bottom + 4, left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, align, menuWidth])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (ref.current?.contains(target)) return
      if (target.closest(`[data-anchored-dropdown-menu="${menuId}"]`)) return
      onOpenChange(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, menuId, onOpenChange])

  const menu =
    open && menuPos
      ? createPortal(
          <div
            data-anchored-dropdown-menu={menuId}
            className="fixed z-[200] rounded-xl border border-stone-200 bg-white py-1 shadow-xl ring-1 ring-black/5 text-left"
            style={{ top: menuPos.top, left: menuPos.left, width: menuWidth }}
            role="menu"
          >
            {children}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => onOpenChange(open ? null : menuId)}
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {trigger}
      </button>
      {menu}
    </div>
  )
}
