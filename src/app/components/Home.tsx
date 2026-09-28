import { useCallback, useEffect, useState } from 'react'
import type { Account } from '@/app/auth'
import { signOut } from '@/app/auth'
import { go } from '@/app/route'
import { deckName, localDeckRepo, type DeckRepo, type SavedDeck } from '@/app/store'
import { DeckCard } from './DeckCard'
import { PromptBox } from './landing/PromptBox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'

interface Props { account: Account; repo: DeckRepo }

/** Your decks: every deck in the account, newest first. Open one to keep editing, or delete it. */
export function Home({ account, repo }: Props) {
  const [decks, setDecks] = useState<SavedDeck[] | null>(null), [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState<SavedDeck[]>([]), [importing, setImporting] = useState(false)
  const [doomed, setDoomed] = useState<SavedDeck | null>(null)

  const load = useCallback(async () => {
    try { setDecks(await repo.list()); setError(null) } catch { setError('Couldn’t load your decks. Check your connection and reload.') }
    setLocal((await localDeckRepo().list()).filter((d) => d.items.length > 0))
  }, [repo])
  useEffect(() => { void load() }, [load])

  // Decks made in this browser before signing in move to the account on request, then leave the browser.
  const importLocal = async () => {
    setImporting(true)
    const browser = localDeckRepo()
    for (const d of local) if (await repo.save(d)) await browser.remove(d.id)
    setImporting(false)
    void load()
  }
  const remove = async () => {
    if (!doomed) return
    const d = doomed
    setDoomed(null)
    setDecks((all) => all?.filter((x) => x.id !== d.id) ?? null)
    if (!(await repo.remove(d.id))) { setError(`Couldn’t delete “${deckName(d)}”. Try again.`); void load() }
  }

  return (
    <div className="site h-full overflow-y-auto bg-paper text-type">
      <header className="site-wrap flex h-16 items-center justify-between">
        <a href="/" className="font-display text-[22px] font-extrabold tracking-[-.01em] [font-stretch:78%]">Occam</a>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go('/new')} className="h-10 rounded-full bg-type px-4 text-[14px] font-medium text-paper">New deck</button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Account" className="grid size-10 place-items-center overflow-hidden rounded-full bg-paper-2 text-[14px] font-medium text-type outline-none focus-visible:ring-2 focus-visible:ring-type">
              {account.image ? <img src={account.image} alt="" className="size-full object-cover" /> : (account.name || account.email).slice(0, 1).toUpperCase()}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px] rounded-xl border-rule bg-white p-1.5 text-type">
              <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5 font-normal">
                {account.name && <span className="text-[14px] font-medium">{account.name}</span>}
                <span className="truncate text-[13px] text-type-2">{account.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-rule" />
              <DropdownMenuItem onSelect={() => void signOut()} className="rounded-lg px-2 py-2 text-[14px] focus:bg-paper-2 focus:text-type">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="site-wrap grid gap-10 pb-24 pt-10">
        {decks && decks.length === 0 && !error ? <Empty /> : (
          <>
            <h1 className="font-display text-[clamp(40px,4.4vw,60px)] font-extrabold leading-none tracking-[-.015em] [font-stretch:78%]">Your decks</h1>
            {local.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_0_0_1px_rgba(18,18,17,.08)]">
                <p className="text-[15px] text-type-2">{local.length === 1 ? 'One deck' : `${local.length} decks`} made in this browser before you signed in.</p>
                <button type="button" onClick={() => void importLocal()} disabled={importing}
                  className="h-10 rounded-full bg-type px-4 text-[14px] font-medium text-paper disabled:opacity-40">{importing ? 'Adding…' : 'Add to my decks'}</button>
              </div>
            )}
            {error && <p role="alert" className="text-[15px] text-[#B42318]">{error}</p>}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-10">
              {decks === null
                ? [0, 1, 2].map((k) => <li key={k} className="aspect-video animate-pulse rounded-xl bg-paper-2" />)
                : decks.map((d) => <li key={d.id}><DeckCard deck={d} onOpen={() => go(`/d/${d.id}`)} onDelete={() => setDoomed(d)} /></li>)}
            </ul>
          </>
        )}
      </main>

      <Dialog open={!!doomed} onOpenChange={(o) => { if (!o) setDoomed(null) }}>
        <DialogContent className="max-w-[400px] gap-0 rounded-[22px] border-0 bg-paper p-7 text-type">
          <DialogTitle className="text-[19px] font-semibold tracking-[-.01em]">Delete “{doomed ? deckName(doomed) : ''}”?</DialogTitle>
          <DialogDescription className="mt-2 text-[15px] leading-[1.5] text-type-2">
            {doomed ? `${doomed.items.length} slide${doomed.items.length === 1 ? '' : 's'} and the chat go with it. This can’t be undone.` : ''}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setDoomed(null)} className="h-10 rounded-full px-4 text-[14px] text-type-2 hover:text-type">Cancel</button>
            <button type="button" onClick={() => void remove()} className="h-10 rounded-full bg-[#B42318] px-4 text-[14px] font-medium text-white">Delete deck</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Empty() {
  return (
    <section className="mx-auto grid w-full max-w-[720px] gap-8 pt-10 text-center">
      <h1 className="site-h2 mx-auto">Your first deck starts with a sentence.</h1>
      <p className="site-lede mx-auto">Paste your doc, notes or numbers. Occam turns them into slides that land your point.</p>
      <div className="text-left"><PromptBox id="home-prompt" autoFocus /></div>
    </section>
  )
}
