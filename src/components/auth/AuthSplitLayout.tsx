import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BRAND_BG, BRAND_LOGO_H } from '@/config/branding'
import { pickAuthQuote } from '@/config/authQuotes'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Ilustración del panel (mozo, cajero, cocinero, delivery). */
  illustrationSrc?: string
  /** En móvil reduce la franja azul (útil para teclado PIN). */
  compactMobile?: boolean
  backTo?: string
  backLabel?: string
  footer?: ReactNode
}

const CHARACTER_DESKTOP_CLASS =
  'pointer-events-none absolute z-30 bottom-0 left-[6%] sm:left-[10%] md:left-[18%] lg:left-[24%] xl:left-[20%] w-[min(82vw,280px)] sm:w-[300px] md:w-[320px] lg:w-[360px] h-auto object-contain object-bottom object-left drop-shadow-2xl'

/**
 * Panel visual (izq) + formulario (der).
 * Centrado vertical en todas las pantallas; scroll solo si el contenido no cabe.
 */
export function AuthSplitLayout({
  children,
  illustrationSrc,
  compactMobile = false,
  backTo,
  backLabel = 'Volver',
  footer,
}: Props) {
  const [quote] = useState(pickAuthQuote)
  const showCharacter = Boolean(illustrationSrc)

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-y-auto pt-safe pb-safe"
      style={{
        backgroundImage: `url(${BRAND_BG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-stone-900/40 pointer-events-none" aria-hidden />

      {backTo && (
        <Link
          to={backTo}
          className="fixed z-30 inline-flex items-center gap-1 font-bold text-md text-white/90 hover:text-white drop-shadow top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))]"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>
      )}

      <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center px-3 sm:px-4 md:px-6 py-[max(3rem,calc(env(safe-area-inset-top)+2.5rem))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          className={`relative w-full mx-auto overflow-visible max-w-5xl ${
            compactMobile ? 'max-md:max-w-[min(100%,26rem)]' : ''
          }`}
        >
          <div
            className={`relative flex w-full flex-col md:flex-row rounded-xl sm:rounded-2xl md:rounded-3xl shadow-2xl overflow-visible bg-[#f4f6f8] md:min-h-[min(640px,90vh)] ${
              compactMobile ? 'max-md:max-h-[min(calc(100dvh-5rem),42rem)]' : ''
            }`}
          >
            {/* Panel marca / franja superior en móvil */}
            <div
              className="relative z-10 md:w-[46%] shrink-0 flex flex-col rounded-t-xl sm:rounded-t-2xl md:rounded-t-none md:rounded-l-2xl lg:rounded-l-3xl overflow-hidden"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(26,54,93,0.94), rgba(30,58,95,0.9)), url(${BRAND_BG})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* Móvil */}
              <div
                className={`md:hidden grid items-end gap-2 ${
                  compactMobile
                    ? 'grid-cols-[1fr_auto] px-3 py-2.5 min-h-[5.5rem]'
                    : 'grid-cols-1 px-4 py-4 min-h-[7.5rem]'
                }`}
              >
                <div className={showCharacter && compactMobile ? 'min-w-0 pr-1' : ''}>
                  <div className="bg-white/90 rounded-xl px-2 py-2 w-max mb-5">
                    <img
                    src={BRAND_LOGO_H}
                    alt="Tukichef"
                    className={`w-auto object-contain brightness-110 ${compactMobile ? 'h-[1.65rem]' : 'h-9'}`}
                  />
                  </div>
                  <div className={compactMobile ? 'mt-1' : 'mt-2.5'}>
                    <p
                      className={`text-white/95 italic font-serif leading-snug ${
                        compactMobile ? 'text-xs line-clamp-2' : 'text-sm sm:text-base max-w-[280px]'
                      }`}
                    >
                      &ldquo;{quote}&rdquo;
                    </p>
                    <div className="w-8 h-0.5 bg-green-600 rounded-full mt-1.5" />
                  </div>
                </div>
                {showCharacter && illustrationSrc && (
                  <img
                    src={illustrationSrc}
                    alt=""
                    className={`object-contain object-bottom pointer-events-none drop-shadow-lg self-end ${
                      compactMobile
                        ? 'w-[clamp(4.5rem,22vw,6.25rem)] max-h-[4.75rem]'
                        : 'w-[clamp(5rem,28vw,8.75rem)] max-h-[6.5rem] justify-self-end'
                    }`}
                  />
                )}
              </div>

              {/* Desktop */}
              <div className="hidden md:block p-6 pb-28">
                <div className="bg-white/90 rounded-xl px-2 py-2 w-max mb-5">
                  <img src={BRAND_LOGO_H} alt="Tukichef" className="h-14 w-auto object-contain brightness-110" />
                </div>
                <div className="mt-5 pr-4">
                  <p className="text-white/95 text-xl italic font-serif leading-snug max-w-[280px]">
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="w-10 h-0.5 bg-green-600 mt-4 rounded-full" />
                </div>
              </div>

              <div className="hidden md:block flex-1 min-h-[180px]" aria-hidden />
            </div>

            {/* Panel formulario */}
            <div className="relative z-20 flex flex-1 flex-col min-w-0 min-h-0 rounded-b-xl sm:rounded-b-2xl md:rounded-b-none md:rounded-r-2xl lg:rounded-r-3xl">
              <div
                className={`flex flex-1 flex-col min-h-0 overflow-y-auto md:justify-center p-4 sm:p-6 md:p-8 lg:p-10 md:pl-12 lg:pl-16 ${
                  compactMobile ? 'max-md:p-3' : ''
                }`}
              >
                {children}
              </div>
              {footer && (
                <div
                  className={`shrink-0 text-center text-[10px] text-stone-400 border-t border-stone-200/80 px-4 sm:px-6 pb-3 sm:pb-4 pt-2 sm:pt-3 ${
                    compactMobile ? 'max-md:hidden' : ''
                  }`}
                >
                  {footer}
                </div>
              )}
            </div>

            {showCharacter && illustrationSrc && (
              <img src={illustrationSrc} alt="" className={`hidden md:block ${CHARACTER_DESKTOP_CLASS}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
