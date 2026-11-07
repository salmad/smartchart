// The engagement emails' two routes, behind api/account.ts (Hobby's 12-function cap):
//  email-cron: run daily by Vercel Cron (vercel.json). Enrols new makers, then sends each one at most one email.
//    Needs `Authorization: Bearer $CRON_SECRET`. Sends only when EMAILS_LIVE=1; otherwise, or with ?dry=1, it reports
//    what it would do. ?test=<address> sends every email once to that address and touches nothing else.
//  email-unsub: /api/unsubscribe?t=<token>. GET shows a confirm button; POST (the button, or a mail app's one-click
//    List-Unsubscribe) takes the maker out of the series.
import { decide } from './series.js'
import { emailStore, type EmailStore } from './store.js'
import { SITE, renderEmail, type EmailKey, type EmailVars } from './templates.js'

const FROM = 'Sam from Occam <sam@occamslides.com>'
const KEYS: EmailKey[] = ['1-connect', '2-line', '3-templates', '4-connect-again', '4b-so-what', '5-cagr', '6-docs', '7-partner']

const unsubscribeUrl = (token: string) => `${SITE}/api/unsubscribe?t=${encodeURIComponent(token)}`
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

async function send(to: string, key: EmailKey, vars: EmailVars, idempotency: string): Promise<{ id: string } | { error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'RESEND_API_KEY is not set' }
  const { subject, html, text } = renderEmail(key, vars)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotency },
    body: JSON.stringify({
      from: FROM, to: [to], subject, html, text,
      headers: { 'List-Unsubscribe': `<${vars.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      tags: [{ name: 'email', value: key.replace(/[^\w-]/g, '_') }],
    }),
  })
  const body = (await r.json().catch(() => ({}))) as { id?: string; message?: string }
  return r.ok && body.id ? { id: body.id } : { error: `${r.status} ${body.message ?? ''}`.trim() }
}

async function run(store: EmailStore, live: boolean, now = new Date()) {
  const enrolled = await store.enrol()
  const report: { email: string; day: number; action: string }[] = []
  for (const m of await store.makers()) {
    const [done, facts] = await Promise.all([store.done(m.userId), store.facts(m.userId)])
    const d = decide(m.started, now, done, facts)
    const day = Math.floor((+now - +m.started) / 86_400_000)
    if (d.kind !== 'done' && live) for (const slot of d.skipped) await store.skip(m.userId, slot)
    const skippedNote = d.kind !== 'done' && d.skipped.length ? ` (skips slot ${d.skipped.join(', ')})` : ''
    if (d.kind !== 'send') { report.push({ email: m.email, day, action: d.kind + skippedNote }); continue }
    if (!live) { report.push({ email: m.email, day, action: `would send ${d.key}${skippedNote}` }); continue }
    if (!(await store.claim(m.userId, d.slot, d.key))) { report.push({ email: m.email, day, action: `slot ${d.slot} already taken` }); continue }
    const vars: EmailVars = { first: firstName(m.name), existing: m.existing, deck: d.key === '5-cagr' ? await store.latestDeck(m.userId) : null, unsubscribeUrl: unsubscribeUrl(m.token) }
    const result = await send(m.email, d.key, vars, `${m.userId}-${d.slot}`)
    await store.settle(m.userId, d.slot, result)
    report.push({ email: m.email, day, action: 'id' in result ? `sent ${d.key}` : `failed ${d.key}: ${result.error}` })
  }
  return { live, enrolled, report }
}

export async function emailCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const url = process.env.DATABASE_URL
  if (!url) return Response.json({ error: 'no database' }, { status: 500 })
  const q = new URL(request.url).searchParams
  const test = q.get('test')
  if (test) {
    const results = []
    for (const key of KEYS) {
      const vars: EmailVars = { first: 'Sam', existing: true, deck: { id: 'example', name: 'Acme board deck' }, unsubscribeUrl: unsubscribeUrl('test') }
      results.push({ key, ...(await send(test, key, vars, `test-${test}-${key}-${Date.now()}`)) })
    }
    return Response.json({ test, results })
  }
  const live = process.env.EMAILS_LIVE === '1' && !q.has('dry')
  return Response.json(await run(emailStore(url), live))
}

const page = (title: string, body: string) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#F5F5F3;font:16px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:#121211"><main style="max-width:480px;margin:15vh auto;padding:0 16px">
<p style="font-weight:700;font-size:20px;margin:0 0 16px">Occam</p>${body}</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

export async function emailUnsubscribe(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('t') ?? ''
  const url = process.env.DATABASE_URL
  if (request.method === 'POST') {
    if (url && token && token !== 'test') await emailStore(url).unsubscribe(token)
    return page('Unsubscribed', '<p>You’re unsubscribed. Occam won’t send you these emails again.</p>')
  }
  return page('Unsubscribe', `<p>Stop getting Occam’s emails about what it can do?</p>
<form method="post"><button style="font:inherit;padding:10px 18px;border:0;border-radius:999px;background:#121211;color:#F5F5F3;cursor:pointer">Unsubscribe</button></form>`)
}
