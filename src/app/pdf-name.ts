/** A deck's name as a PDF file name: no characters a file system rejects. */
export const pdfName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Deck'
