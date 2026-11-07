/** A display name as a download file name: no characters file systems reject. */
export const fileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Download'

export function downloadText(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}
