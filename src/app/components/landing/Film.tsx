import { useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { cn } from '@/app/lib/utils'

/* The landing film: the Occam ad, as a video with its voice-over. It waits on its poster (the thesis frame) until asked:
   the voice carries the story, and a browser only autoplays muted. Once playing, the browser's own controls take over
   (pause, seek, full screen, captions). The film is made in docs/temp/occam-film and published to Vercel Blob with
   `npm run film:upload`, under fixed names: a new cut needs no change here. */

const SRC = 'https://i22hzrcpnvzinqep.public.blob.vercel-storage.com/film/occam'
const LENGTH = '44 s'

export function Film() {
  const video = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const start = () => {
    setStarted(true)
    void video.current?.play()
  }
  return (
    <figure className="relative aspect-video w-full overflow-hidden rounded-[24px] bg-[#0B0A09] shadow-[0_0_0_1px_rgba(243,238,228,.08),0_40px_100px_-40px_rgba(0,0,0,.9)] max-[700px]:rounded-[14px]">
      <video ref={video} poster={`${SRC}-poster.jpg`} preload="none" playsInline controls={started} crossOrigin="anonymous"
        aria-label="The Occam film: a busy slide, one request, the slide Occam builds and the three reviews it passes"
        className="absolute inset-0 size-full" onPlay={() => setStarted(true)}>
        <source src={`${SRC}-720.mp4`} type="video/mp4" media="(max-width: 900px)" />
        <source src={`${SRC}-1080.mp4`} type="video/mp4" />
        <track kind="captions" src={`${SRC}-en.vtt`} srcLang="en" label="English" />
      </video>
      {/* Before it plays: one button over the poster (the thesis over three slides), in the corner so the line stays clear;
          the whole frame is its target. */}
      <button type="button" onClick={start} aria-label={`Play the film, ${LENGTH}, with sound`}
        className={cn('group absolute inset-0 flex items-end justify-start p-[3.5%] transition-opacity duration-300',
          started && 'pointer-events-none opacity-0')}>
        <span className="flex items-center gap-3 rounded-full bg-[#F3EEE4] py-3 pl-4 pr-6 text-[15px] font-medium max-[700px]:gap-2 max-[700px]:py-1.5 max-[700px]:pl-1.5 max-[700px]:pr-3.5 max-[700px]:text-[13px] text-stage shadow-[0_12px_40px_-8px_rgba(0,0,0,.6)] transition-transform duration-300 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]">
          <span className="grid size-9 place-items-center rounded-full bg-[#E8B94A] max-[700px]:size-7"><Play className="size-4 max-[700px]:size-3 translate-x-px fill-current" strokeWidth={0} aria-hidden /></span>
          Watch the film <span className="text-type-3">{LENGTH}</span>
        </span>
      </button>
    </figure>
  )
}
