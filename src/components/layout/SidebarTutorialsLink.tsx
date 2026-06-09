import { ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import { YOUTUBE_TUTORIALS_URL } from '@/constants/tutorials'

type Props = {
  collapsed?: boolean
  mini?: boolean
  onNavigate?: () => void
}

function AnimatedYouTubeIcon({ size = 22 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full overflow-visible">
        <rect
          x="1.5"
          y="4"
          width="21"
          height="16"
          rx="4.5"
          className="fill-[#FF0000] youtube-icon-bg"
        />
        <g className="youtube-icon-play-wrap">
          <path d="M10 8.25v7.5l6.75-3.75L10 8.25z" className="fill-white" />
        </g>
      </svg>
    </span>
  )
}

export default function SidebarTutorialsLink({ collapsed, mini, onNavigate }: Props) {
  const handleClick = () => {
    onNavigate?.()
  }

  if (collapsed || mini) {
    return (
      <a
        href={YOUTUBE_TUTORIALS_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        title="Tutoriales"
        className="flex justify-center touch-manipulation"
      >
        <span
          className={clsx(
            'inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-sm transition-shadow hover:shadow-md',
            mini && 'ring-1 ring-white/20',
          )}
        >
          <AnimatedYouTubeIcon size={20} />
        </span>
      </a>
    )
  }

  return (
    <a
      href={YOUTUBE_TUTORIALS_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="group flex items-center gap-3 rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-stone-900 shadow-sm transition-all hover:border-stone-300 hover:shadow-md touch-manipulation"
    >
      <AnimatedYouTubeIcon size={22} />
      <span className="min-w-0 flex-1 truncate">Tutoriales</span>
      <ExternalLink
        size={15}
        className="shrink-0 text-stone-400 transition-colors group-hover:text-stone-600"
        strokeWidth={2}
      />
    </a>
  )
}
