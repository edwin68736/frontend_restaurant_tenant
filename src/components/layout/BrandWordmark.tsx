import { clsx } from 'clsx'

type Props = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClass = {
  sm: 'text-base sm:text-lg',
  md: 'text-lg sm:text-xl',
  lg: 'text-xl sm:text-2xl',
} as const

/** Marca textual: Tuki (verde) + Chef (azul). */
export default function BrandWordmark({ className, size = 'md' }: Props) {
  return (
    <span
      className={clsx('shrink-0 tracking-tight leading-none select-none', sizeClass[size], className)}
      aria-label="TukiChef"
    >
      <span className="text-rest-700 font-bold">Tuki</span>
      <span className="text-blue-900 font-bold">Chef</span>
    </span>
  )
}
