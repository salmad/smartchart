import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { agentKey, CLIENTS, skillCommand, type AgentKeyInfo } from '@/app/agent-key'
import { cn } from '@/app/lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

/** Connect an agent: up to five keys, one per agent. A new key is shown once, with one step for each agent client: a
    command, an install link or config to paste. Claude Code can also take the Occam skill, so it reaches for Occam unasked. */
export function AgentKey({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [keys, setKeys] = useState<AgentKeyInfo[]>([]), [max, setMax] = useState(5), [key, setKey] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null), [copied, setCopied] = useState<string | null>(null), [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState(CLIENTS[0].id)
  const fullMessage = (e: unknown, fallback: string) => setError(e instanceof Error ? e.message : fallback)

  useEffect(() => {
    if (!open) return
    setKey(null); setConfirm(null); setError(null)
    void agentKey.list().then((r) => { setKeys(r.keys); setMax(r.max) }, () => setKeys([]))
  }, [open])

  const make = () => {
    setError(null)
    agentKey.make().then((k) => { setKey(k.key); setKeys((ks) => [...ks, { id: k.id, prefix: k.prefix, created: Date.now(), lastUsed: null }]) }, (e: unknown) => fullMessage(e, 'Couldn’t make a key.'))
  }
  const remove = (id: string) => {
    agentKey.remove(id).then(() => { setKeys((ks) => ks.filter((k) => k.id !== id)); setConfirm(null) }, (e: unknown) => fullMessage(e, 'Couldn’t remove the key.'))
  }
  const c = CLIENTS.find((x) => x.id === client) ?? CLIENTS[0], value = key ? c.value(location.origin, key) : '', skill = skillCommand(location.origin)
  const copy = (what: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => { setCopied(what); window.setTimeout(() => setCopied(null), 1500) }, () => undefined)
  }
  const copyButton = (what: string, text: string, label: string) => (
    <Button variant="outline" size="sm" onClick={() => copy(what, text)} aria-label={label}>{copied === what ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</Button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Connect an agent</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">Let Claude Code or another agent work on your decks. Each key acts as you; keep them private. You can have up to {max}.</DialogDescription>
        {key && (
          <div className="mt-5 grid gap-3">
            <div role="tablist" aria-label="Agent" className="flex flex-wrap gap-1">
              {CLIENTS.map((x) => (
                <button key={x.id} type="button" role="tab" aria-selected={x.id === client} onClick={() => setClient(x.id)}
                  className={cn('h-7 rounded-md px-2.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink-2', x.id === client && 'bg-panel text-ink shadow-[0_0_0_1px_theme(colors.line-2)]')}>{x.name}</button>
              ))}
            </div>
            <div role="tabpanel" aria-label={c.name} className="grid gap-2">
              {c.how === 'link'
                ? <Button asChild className="justify-self-start"><a href={value}><ExternalLink className="size-3.5" />Add to {c.name}</a></Button>
                : <div className="flex items-start gap-2 rounded-lg border border-line-2 bg-panel p-3">
                    <code className="min-w-0 flex-1 select-all whitespace-pre-wrap break-all font-mono text-[12px] leading-[1.5] text-ink">{value}</code>
                    {copyButton(c.id, value, c.how === 'command' ? 'Copy command' : 'Copy config')}
                  </div>}
              <p className="text-[12.5px] leading-[1.45] text-ink-3">{c.note} You won’t see this key again.</p>
            </div>
            {c.id === 'claude-code' && (
              <div className="grid gap-2 border-t border-line pt-3">
                <p className="text-[12.5px] leading-[1.45] text-ink-2">Optional: the Occam skill, so Claude Code reaches for Occam whenever you ask for slides.</p>
                <div className="flex items-start gap-2 rounded-lg border border-line-2 bg-panel p-3">
                  <code className="min-w-0 flex-1 select-all break-all font-mono text-[12px] leading-[1.5] text-ink">{skill}</code>
                  {copyButton('skill', skill, 'Copy skill command')}
                </div>
              </div>
            )}
          </div>
        )}
        {keys.length > 0 && (
          <ul className="mt-5 grid gap-1.5">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 rounded-lg border border-line-2 bg-panel px-3 py-2 text-[13px] text-ink-2">
                <span><span className="font-mono text-ink">{k.prefix}…</span> <span className="text-ink-3">· made {new Date(k.created).toLocaleDateString()}</span></span>
                {confirm === k.id
                  ? <span className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Cancel</Button><Button size="sm" onClick={() => remove(k.id)}>Remove</Button></span>
                  : <Button variant="outline" size="sm" onClick={() => setConfirm(k.id)} aria-label={`Remove key ${k.prefix}`}>Remove</Button>}
              </li>
            ))}
          </ul>
        )}
        {confirm && <p className="mt-3 text-[13px] text-ink-2">Remove this key? Agents using it stop working.</p>}
        {error && <p role="alert" className="mt-3 text-[13px] text-ink-2">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={make} disabled={keys.length >= max}>{keys.length ? 'Make another key' : 'Make a key'}</Button>
        </div>
        {!key && <p className="mt-4 text-[12.5px] text-ink-3">Make a key to get the one step for Claude Code, Cursor, VS Code, Claude Desktop or any MCP client.</p>}
      </DialogContent>
    </Dialog>
  )
}
