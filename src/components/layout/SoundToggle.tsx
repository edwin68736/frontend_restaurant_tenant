import { Volume2, VolumeX } from 'lucide-react'
import { setSoundEnabled, useSoundEnabled } from '@/utils/soundPrefs'

/** Silencia o activa los sonidos del carrito (POS y Mesa). Preferencia local por usuario. */
export default function SoundToggle() {
  const soundOn = useSoundEnabled()
  return (
    <button
      type="button"
      onClick={() => setSoundEnabled(!soundOn)}
      title={soundOn ? 'Sonidos activados: clic para silenciar' : 'Sonidos silenciados: clic para activar'}
      aria-label={soundOn ? 'Silenciar sonidos del punto de venta' : 'Activar sonidos del punto de venta'}
      aria-pressed={!soundOn}
      className="relative inline-flex items-center justify-center rounded-lg p-2 text-stone-600 transition-colors hover:bg-rest-50 hover:text-rest-700 touch-manipulation"
    >
      {soundOn ? <Volume2 size={20} strokeWidth={2} /> : <VolumeX size={20} strokeWidth={2} className="text-stone-400" />}
    </button>
  )
}
