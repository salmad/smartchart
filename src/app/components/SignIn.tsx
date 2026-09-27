import { useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog'
import { sendCode, signInWithGoogle, verifyCode } from '@/app/auth'
import { cn } from '@/app/lib/utils'

interface Props {
  open: boolean; onOpenChange: (open: boolean) => void
  title?: string; lede?: string
  /** Where Google brings the user back to; the email code signs in without leaving. */
  returnTo: string
  onSignedIn?: () => void
}

const field = 'h-12 w-full rounded-xl border border-rule bg-white px-4 text-[15px] text-type outline-none transition-shadow placeholder:text-type-3 focus:border-type focus:shadow-[0_0_0_1px_#121211]'
const primary = 'h-12 w-full rounded-xl bg-type text-[15px] font-medium text-paper transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-type focus-visible:ring-offset-2'

/** Sign in or keep a deck: Continue with Google, or a 6-digit code sent to any email. Always on paper. */
export function SignIn({ open, onOpenChange, title = 'Sign in to SmartChart', lede = 'Your decks are saved to your account, on every device.', returnTo, onSignedIn }: Props) {
  const [email, setEmail] = useState(''), [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email'), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true); setError(null)
    const err = await fn().catch(() => 'That didn’t work. Check your connection and try again.')
    setBusy(false); setError(err)
    return !err
  }
  const google = () => void run(() => signInWithGoogle(returnTo))
  const send = (e: FormEvent) => { e.preventDefault(); void run(() => sendCode(email.trim())).then((ok) => { if (ok) setStep('code') }) }
  const verify = (e: FormEvent) => {
    e.preventDefault()
    void run(() => verifyCode(email.trim(), code.trim())).then((ok) => { if (ok) { onOpenChange(false); onSignedIn?.() } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] gap-0 rounded-[22px] border-0 bg-paper p-8 text-type shadow-[0_40px_120px_-20px_rgba(0,0,0,.45)] max-[480px]:p-6">
        <DialogTitle className="font-display text-[34px] font-extrabold leading-[1] tracking-[-.015em] [font-stretch:78%]">{title}</DialogTitle>
        <DialogDescription className="mt-3 text-[15px] leading-[1.5] text-type-2">{lede}</DialogDescription>

        {step === 'email' ? (
          <div className="mt-7 grid gap-3">
            <button type="button" onClick={google} disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-rule bg-white text-[15px] font-medium text-type transition-colors hover:border-type-3 disabled:opacity-40">
              <GoogleMark /> Continue with Google
            </button>
            <div className="my-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[13px] text-type-3" aria-hidden>
              <span className="h-px bg-rule" />or<span className="h-px bg-rule" />
            </div>
            <form onSubmit={send} className="grid gap-3">
              <label htmlFor="signin-email" className="sr-only">Email</label>
              <input id="signin-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={field} />
              <button type="submit" disabled={busy || !email.includes('@')} className={primary}>{busy ? 'Sending…' : 'Email me a code'}</button>
            </form>
          </div>
        ) : (
          <form onSubmit={verify} className="mt-7 grid gap-3">
            <p className="text-[14px] text-type-2">We sent a 6-digit code to <b className="font-medium text-type">{email}</b>.</p>
            <label htmlFor="signin-code" className="sr-only">Code</label>
            <input id="signin-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
              className={cn(field, 'text-center font-mono text-[22px] tracking-[.4em]')} />
            <button type="submit" disabled={busy || code.length !== 6} className={primary}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(null) }} className="h-10 text-[14px] text-type-2 hover:text-type">Use a different email</button>
          </form>
        )}
        {error && <p role="alert" className="mt-4 text-[14px] text-[#B42318]">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  )
}
