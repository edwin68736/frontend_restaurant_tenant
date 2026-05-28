import beepSrc from '@/assets/sound/beep-29.mp3'
import clearSrc from '@/assets/sound/button-21.mp3'

let addAudio: HTMLAudioElement | null = null
let clearAudio: HTMLAudioElement | null = null

function playClip(getAudio: () => HTMLAudioElement) {
  try {
    const audio = getAudio()
    audio.currentTime = 0
    void audio.play().catch(() => {
      /* autoplay policy o sin altavoz */
    })
  } catch {
    /* ignore */
  }
}

export function playCartAddSound() {
  playClip(() => {
    if (!addAudio) {
      addAudio = new Audio(beepSrc)
      addAudio.volume = 0.55
    }
    return addAudio
  })
}

export function playCartClearSound() {
  playClip(() => {
    if (!clearAudio) {
      clearAudio = new Audio(clearSrc)
      clearAudio.volume = 0.55
    }
    return clearAudio
  })
}
