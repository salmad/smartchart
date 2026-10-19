import { useEffect, useState } from 'react'

/** The initial, with the picture fading in over it once it has loaded; a picture that fails leaves the initial. */
export function Avatar({ name, image }: { name: string; image: string | null }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLoaded(false)
    if (!image) return
    const probe = new Image()
    probe.onload = () => setLoaded(true)
    probe.src = image
    return () => { probe.onload = null }
  }, [image])
  return (
    <>
      {name.slice(0, 1).toUpperCase()}
      {loaded && image && <img src={image} alt="" className="absolute inset-0 size-full animate-in fade-in object-cover duration-200" />}
    </>
  )
}
