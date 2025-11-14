import type { ColorPalette, SeriesColor } from '@/types/chart'

export interface PaletteMetadata {
  id: ColorPalette
  name: string
  description: string
  colors: SeriesColor[]
  previewColors: string[] // For UI preview dots
}

/**
 * Premium color palettes inspired by Linear, Revolut, Canvas, and Framer
 * Each palette is executive-ready with carefully selected color harmonies
 */
export const COLOR_PALETTES: Record<ColorPalette, PaletteMetadata> = {
   revolut: {
    id: 'revolut',
    name: 'High Energy',
    description: 'High-energy, fintech-inspired, dynamic',
    colors: [
      { gradient: 'colorA', solid: 'hsl(210, 100%, 56%)' }, // Electric Blue
      { gradient: 'colorB', solid: 'hsl(270, 100%, 65%)' }, // Neon Purple
      { gradient: 'colorC', solid: 'hsl(330, 100%, 70%)' }, // Cyber Pink
      { gradient: 'colorD', solid: 'hsl(160, 84%, 45%)' },  // Tech Green
      { gradient: 'colorE', solid: 'hsl(25, 100%, 58%)' },  // Volt Orange
    ],
    previewColors: [
      'hsl(210, 100%, 56%)',
      'hsl(270, 100%, 65%)',
      'hsl(330, 100%, 70%)',
      'hsl(160, 84%, 45%)',
      'hsl(25, 100%, 58%)',
    ],
  },
  
  founder: {
    id: 'founder',
    name: 'Founder Mode',
    description: 'Bold, energetic, startup-ready',
    colors: [
      { gradient: 'colorA', solid: 'hsl(262, 80%, 60%)' },  // Vibrant Purple
      { gradient: 'colorB', solid: 'hsl(199, 89%, 48%)' },  // Ocean Blue
      { gradient: 'colorC', solid: 'hsl(142, 71%, 45%)' },  // Emerald Green
      { gradient: 'colorD', solid: 'hsl(280, 65%, 60%)' },  // Rich Violet
      { gradient: 'colorE', solid: 'hsl(24, 95%, 53%)' },   // Warm Amber
    ],
    previewColors: [
      'hsl(262, 80%, 60%)',
      'hsl(199, 89%, 48%)',
      'hsl(142, 71%, 45%)',
      'hsl(280, 65%, 60%)',
      'hsl(24, 95%, 53%)',
    ],
  },

  executive: {
    id: 'executive',
    name: 'Executive Suite',
    description: 'Sophisticated, boardroom-ready, timeless',
    colors: [
      { gradient: 'colorA', solid: 'hsl(220, 45%, 25%)' },  // Deep Navy
      { gradient: 'colorB', solid: 'hsl(43, 74%, 49%)' },   // Premium Gold
      { gradient: 'colorC', solid: 'hsl(210, 16%, 53%)' },  // Steel Gray
      { gradient: 'colorD', solid: 'hsl(355, 65%, 40%)' },  // Burgundy Red
      { gradient: 'colorE', solid: 'hsl(145, 25%, 50%)' },  // Sage Green
    ],
    previewColors: [
      'hsl(220, 45%, 25%)',
      'hsl(43, 74%, 49%)',
      'hsl(210, 16%, 53%)',
      'hsl(355, 65%, 40%)',
      'hsl(145, 25%, 50%)',
    ],
  },

  arctic: {
    id: 'arctic',
    name: 'Arctic Minimal',
    description: 'Clean, Scandinavian, modern minimalism',
    colors: [
      { gradient: 'colorA', solid: 'hsl(200, 70%, 65%)' },  // Ice Blue
      { gradient: 'colorB', solid: 'hsl(215, 20%, 45%)' },  // Slate Gray
      { gradient: 'colorC', solid: 'hsl(0, 0%, 95%)' },     // Frost White
      { gradient: 'colorD', solid: 'hsl(205, 45%, 50%)' },  // Steel Blue
      { gradient: 'colorE', solid: 'hsl(165, 45%, 65%)' },  // Cool Mint
    ],
    previewColors: [
      'hsl(200, 70%, 65%)',
      'hsl(215, 20%, 45%)',
      'hsl(0, 0%, 95%)',
      'hsl(205, 45%, 50%)',
      'hsl(165, 45%, 65%)',
    ],
  },

 

  linear: {
    id: 'linear',
    name: 'Linear Dark',
    description: 'Subtle, elegant, design-forward',
    colors: [
      { gradient: 'colorA', solid: 'hsl(235, 45%, 60%)' },  // Soft Indigo
      { gradient: 'colorB', solid: 'hsl(340, 45%, 65%)' },  // Muted Rose
      { gradient: 'colorC', solid: 'hsl(180, 40%, 55%)' },  // Calm Teal
      { gradient: 'colorD', solid: 'hsl(35, 60%, 65%)' },   // Warm Sand
      { gradient: 'colorE', solid: 'hsl(270, 35%, 70%)' },  // Dusty Lavender
    ],
    previewColors: [
      'hsl(235, 45%, 60%)',
      'hsl(340, 45%, 65%)',
      'hsl(180, 40%, 55%)',
      'hsl(35, 60%, 65%)',
      'hsl(270, 35%, 70%)',
    ],
  },
}

/**
 * Get palette colors by ID
 */
export function getPaletteColors(paletteId: ColorPalette): SeriesColor[] {
  return COLOR_PALETTES[paletteId].colors
}

/**
 * Get all available palettes as an array
 */
export function getAllPalettes(): PaletteMetadata[] {
  return Object.values(COLOR_PALETTES)
}
