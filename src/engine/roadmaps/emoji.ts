// An option's mark: one emoji, or up to two letters or digits (UK, FR, P1). The catalogue is the picker's grid and the
// closed set a suggestion chooses from; anything else can still be typed.
import type { JevFn } from '../agent/llm.js'

export interface EmojiEntry { id: string; emoji: string; name: string; kind: 'flag' | 'marker' }

/** A country's flag from its two-letter code: two regional-indicator letters. */
const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

const COUNTRY_CODES = (
  'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU ' +
  'CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET EU FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL ' +
  'IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO ' +
  'MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG ' +
  'SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG UN US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW'
).split(' ')

const regionName = (() => {
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' })
    return (code: string) => names.of(code) ?? code
  } catch {
    return (code: string) => code
  }
})()

/** Plain markers, each with what it usually stands for, so a suggestion can match it to an option's name. */
const MARKERS: [string, string, string][] = [
  ['red', '🔴', 'red circle'], ['orange', '🟠', 'orange circle'], ['yellow', '🟡', 'yellow circle'], ['green', '🟢', 'green circle'],
  ['blue', '🔵', 'blue circle'], ['purple', '🟣', 'purple circle'], ['brown', '🟤', 'brown circle'], ['white', '⚪', 'white circle'],
  ['black', '⚫', 'black circle'], ['redsq', '🟥', 'red square'], ['greensq', '🟩', 'green square'], ['bluesq', '🟦', 'blue square'],
  ['star', '⭐', 'star: priority, highlight, favourite'], ['sparkles', '✨', 'sparkles: new, delight'], ['fire', '🔥', 'fire: urgent, hot'],
  ['warning', '⚠️', 'warning: risk, caution'], ['stop', '🛑', 'stop sign: blocked, halt'], ['check', '✅', 'check mark: done, approved'],
  ['cross', '❌', 'cross: rejected, cancelled'], ['question', '❓', 'question: open question, unknown'], ['pin', '📌', 'pin: pinned, key item'],
  ['target', '🎯', 'target: goal, objective, focus'], ['rocket', '🚀', 'rocket: launch, go-to-market, release'], ['flagc', '🏁', 'chequered flag: milestone, finish'],
  ['trophy', '🏆', 'trophy: win, award'], ['bulb', '💡', 'light bulb: idea, innovation, discovery'], ['test', '🧪', 'test tube: experiment, pilot, research, lab'],
  ['micro', '🔬', 'microscope: science, analysis'], ['compass', '🧭', 'compass: strategy, direction'], ['map', '🗺️', 'map: planning, territory, regions'],
  ['globe', '🌍', 'globe: global, international, world'], ['city', '🏙️', 'city: urban, metro'], ['house', '🏠', 'house: home, housing, real estate'],
  ['building', '🏢', 'office building: corporate, enterprise, office'], ['factory', '🏭', 'factory: manufacturing, industry, supply'], ['bank', '🏦', 'bank: banking, credit, lending'],
  ['hospital', '🏥', 'hospital: health, medical'], ['school', '🏫', 'school: education, training'], ['store', '🏬', 'store: retail, shops'],
  ['cart', '🛒', 'shopping cart: commerce, e-commerce, purchasing'], ['money', '💰', 'money bag: finance, revenue, budget'], ['card', '💳', 'credit card: payments'],
  ['coin', '🪙', 'coin: pricing, cost'], ['chartup', '📈', 'rising chart: growth, metrics, sales'], ['chartdown', '📉', 'falling chart: decline, cost cutting'],
  ['bars', '📊', 'bar chart: analytics, reporting, data'], ['data', '🗄️', 'filing cabinet: data, records, storage'], ['doc', '📄', 'document: policy, paperwork, docs'],
  ['clipboard', '📋', 'clipboard: checklist, process, audit'], ['calendar', '📅', 'calendar: schedule, timeline, events'], ['clock', '⏱️', 'stopwatch: speed, deadline, time'],
  ['hourglass', '⏳', 'hourglass: waiting, pending'], ['shield', '🛡️', 'shield: risk, security, compliance, protection'], ['lock', '🔒', 'lock: privacy, access, security'],
  ['key', '🔑', 'key: access, credentials, key accounts'], ['law', '⚖️', 'scales: legal, regulation, compliance'], ['gear', '⚙️', 'gear: operations, engineering, settings'],
  ['tools', '🛠️', 'tools: maintenance, build, fixes'], ['laptop', '💻', 'laptop: technology, platform, software'], ['phone', '📱', 'phone: mobile, app'],
  ['cloud', '☁️', 'cloud: infrastructure, hosting'], ['robot', '🤖', 'robot: AI, automation'], ['plug', '🔌', 'plug: integrations, API'],
  ['link', '🔗', 'link: dependencies, partnerships'], ['package', '📦', 'package: product, delivery, shipping'], ['truck', '🚚', 'truck: logistics, distribution'],
  ['plane', '✈️', 'airplane: travel, expansion, international'], ['ship', '🚢', 'ship: shipping, freight'], ['car', '🚗', 'car: automotive, mobility'],
  ['bolt', '⚡', 'lightning: energy, power, quick wins'], ['leaf', '🌱', 'seedling: sustainability, ESG, early stage'], ['recycle', '♻️', 'recycling: circular, reuse'],
  ['water', '💧', 'droplet: water, utilities'], ['sun', '☀️', 'sun: solar, summer'], ['snow', '❄️', 'snowflake: winter, frozen'],
  ['people', '👥', 'people: team, people, HR, hiring'], ['person', '👤', 'person: individual, owner, customer'], ['handshake', '🤝', 'handshake: partners, sales, deals'],
  ['megaphone', '📣', 'megaphone: marketing, communications, PR'], ['speech', '💬', 'speech bubble: support, feedback, chat'], ['mail', '✉️', 'envelope: email, outreach'],
  ['heart', '❤️', 'heart: customer love, wellbeing, care'], ['brain', '🧠', 'brain: thinking, knowledge, insights'], ['book', '📚', 'books: learning, content, knowledge base'],
  ['palette', '🎨', 'palette: design, brand, creative'], ['camera', '📷', 'camera: media, content'], ['music', '🎵', 'music: audio, entertainment'],
  ['game', '🎮', 'game controller: gaming'], ['food', '🍽️', 'plate: food, hospitality, restaurants'], ['medal', '🥇', 'gold medal: first, tier one'],
  ['one', '1️⃣', 'one: phase 1, first'], ['two', '2️⃣', 'two: phase 2, second'], ['three', '3️⃣', 'three: phase 3, third'],
]

export const EMOJI: EmojiEntry[] = [
  ...COUNTRY_CODES.map((code): EmojiEntry => ({ id: `c${code}`, emoji: flag(code), name: `flag of ${regionName(code)} (${code})`, kind: 'flag' })),
  ...MARKERS.map(([id, emoji, name]): EmojiEntry => ({ id, emoji, name, kind: 'marker' })),
]

/** The flags and markers the picker shows first; the rest stay reachable by suggestion or by typing. */
export const PICKER_EMOJI = ['cGB', 'cFR', 'cDE', 'cES', 'cIT', 'cNL', 'cIE', 'cUS', 'cCA', 'cBR', 'cSG', 'cJP', 'cIN', 'cAE', 'cAU', 'cEU',
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'star', 'target', 'rocket', 'money', 'chartup', 'shield', 'gear', 'people', 'package', 'test']
  .map((id) => EMOJI.find((e) => e.id === id)?.emoji ?? '')

const graphemes = (s: string): string[] => {
  try {
    return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].map((g) => g.segment)
  } catch {
    return [...s]
  }
}

/** An option's mark as it is kept: one emoji as typed, or one or two letters or digits in capitals ("uk" is "UK").
    Anything else (a word, three letters, a symbol and a letter) is null, and the person is told what fits. */
export function markOf(raw: string): string | null {
  const g = graphemes(raw.trim())
  if (g.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g[0])) return g[0]
  if (g.length >= 1 && g.length <= 2 && g.every((c) => /^[\p{L}\p{N}]$/u.test(c))) return g.join('').toUpperCase()
  return null
}

/** Whether a mark is letters (drawn as a small badge) rather than an emoji. */
export const isLetterMark = (mark: string): boolean => /^[\p{L}\p{N}]{1,2}$/u.test(mark)

const FLAGS = EMOJI.filter((e) => e.kind === 'flag')
const MARKS = EMOJI.filter((e) => e.kind === 'marker')
const choicesOf = (list: EmojiEntry[]) => ({ none: 'Nothing here fits', ...Object.fromEntries(list.map((e) => [e.id, e.name])) })

/** One call to Jev, three closed-set questions per option (a question holds at most 255 choices): is the option a
    place, which flag, which marker. A place takes its flag, anything else its marker. An option with no good match
    gets none; a weak answer (below half) is left out too, so the person decides. */
export async function suggestEmoji(jev: JevFn, field: string, options: { id: string; name: string }[]): Promise<Record<string, string>> {
  if (!options.length) return {}
  const about = (o: { name: string }) => `A roadmap field called "${field}" has an option called "${o.name}".`
  // Question ids are plain identifiers on the wire; the option ids go back in order.
  const questions = Object.fromEntries(options.flatMap((o, i) => [
    [`k${i}`, { instructions: `${about(o)} Is the option a country, region or other place (or its code)?`, options: { place: 'Yes, a place', other: 'No, something else' } }],
    [`f${i}`, { instructions: `${about(o)} If it names a country or region, or its code, pick that flag; otherwise none.`, options: choicesOf(FLAGS) }],
    [`m${i}`, { instructions: `${about(o)} Pick the marker whose meaning best matches the option's name, so it reads at a glance; none when nothing fits.`, options: choicesOf(MARKS) }],
  ]))
  const answers = await jev(`Roadmap field "${field}" with options: ${options.map((o) => o.name).join(', ')}`, questions)
  const sure = (id: string) => {
    const a = answers[id]
    return a && a.choice !== 'none' && a.p >= 0.5 ? EMOJI.find((e) => e.id === a.choice) : undefined
  }
  const out: Record<string, string> = {}
  for (const [i, o] of options.entries()) {
    const hit = answers[`k${i}`]?.choice === 'place' ? sure(`f${i}`) ?? sure(`m${i}`) : sure(`m${i}`)
    if (hit) out[o.id] = hit.emoji
  }
  return out
}
