import { useEffect, useRef, useState } from 'react'
import { Play, Volume2 } from 'lucide-react'
import { cn } from '@/app/lib/utils'

/* The landing film: the Occam ad, with its voice-over. In view it plays muted and looping, the captions carrying the voice
   (a browser only autoplays muted); out of view it pauses. "Watch with sound" starts it over from the top with sound and
   the browser's own controls. With reduced motion it waits on its poster (the thesis frame) until asked.
   The film is made in docs/temp/occam-film and published to Vercel Blob with `npm run film:upload`, under fixed names:
   a new cut needs no change here. */

const SRC = 'https://i22hzrcpnvzinqep.public.blob.vercel-storage.com/film/occam'
const LENGTH = '44 s'

type Mode = 'poster' | 'muted' | 'sound'

export function Film() {
  const ref = useRef<HTMLVideoElement>(null)
  const [mode, setMode] = useState<Mode>('poster')

  // Muted autoplay while half the frame is on screen, unless the viewer asks for less motion or has chosen sound.
  useEffect(() => {
    const v = ref.current
    if (!v || mode === 'sound' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return v.pause()
      v.muted = true
      v.play().then(() => setMode('muted'), () => undefined)
    }, { threshold: 0.5 })
    io.observe(v)
    return () => io.disconnect()
  }, [mode])

  // Captions show while muted: they are the voice. With sound they are the viewer's to turn on.
  useEffect(() => {
    const track = ref.current?.textTracks[0]
    if (track) track.mode = mode === 'muted' ? 'showing' : 'hidden'
  }, [mode])

  const withSound = () => {
    const v = ref.current
    if (!v) return
    setMode('sound')
    v.muted = false
    v.currentTime = 0
    void v.play()
  }

  return (
    <figure className="relative aspect-video w-full overflow-hidden rounded-[24px] bg-[#0B0A09] shadow-[0_0_0_1px_rgba(243,238,228,.08),0_40px_100px_-40px_rgba(0,0,0,.9)] max-[700px]:rounded-[14px]">
      <video ref={ref} poster={`${SRC}-poster.jpg`} preload="none" playsInline crossOrigin="anonymous"
        loop={mode !== 'sound'} controls={mode === 'sound'}
        aria-label="The Occam film: a busy slide, one request, the slide Occam builds and the three reviews it passes"
        className="site-film absolute inset-0 size-full">
        <source src={`${SRC}-720.mp4`} type="video/mp4" media="(max-width: 900px)" />
        <source src={`${SRC}-1080.mp4`} type="video/mp4" />
        <track kind="captions" src={`${SRC}-en.vtt`} srcLang="en" label="English" />
      </video>
      {/* Until there is sound: one button, the whole frame its target, the pill in the corner so the picture stays clear.
          On a phone just its icon, top left, clear of the captions. */}
      <button type="button" onClick={withSound} aria-label={`Watch the film from the start, with sound (${LENGTH})`}
        className={cn('group absolute inset-0 flex items-end justify-start p-[3.5%] transition-opacity duration-300 max-[700px]:items-start',
          mode === 'sound' && 'pointer-events-none opacity-0')}>
        <span className="flex items-center gap-3 rounded-full bg-[#F3EEE4] py-3 pl-4 pr-6 text-[15px] font-medium text-stage shadow-[0_12px_40px_-8px_rgba(0,0,0,.6)] transition-transform duration-300 group-hover:scale-[1.04] group-focus-visible:scale-[1.04] max-[700px]:bg-transparent max-[700px]:p-0 max-[700px]:shadow-none">
          <span className="grid size-9 place-items-center rounded-full bg-[#E8B94A] text-stage shadow-[0_8px_24px_-6px_rgba(0,0,0,.6)]">
            {mode === 'poster'
              ? <Play className="size-4 translate-x-px fill-current" strokeWidth={0} aria-hidden />
              : <Volume2 className="size-4" strokeWidth={2.25} aria-hidden />}
          </span>
          <span className="max-[700px]:hidden">{mode === 'poster' ? 'Watch the film' : 'Watch with sound'} <span className="text-type-3">{LENGTH}</span></span>
        </span>
      </button>
    </figure>
  )
}
