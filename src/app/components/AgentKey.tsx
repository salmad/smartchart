import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { agentKey, connectCommand, type AgentKeyInfo } from '@/app/agent-key'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

/** Connect an agent: up to five keys, one per agent. A new key is shown once, with the Claude Code command. */
export function AgentKey({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [keys, setKeys] = useState<AgentKeyInfo[]>([]), [max, setMax] = useState(5), [key, setKey] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null), [copied, setCopied] = useState(false), [error, setError] = useState<string | null>(null)
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
  const command = key ? connectCommand(location.origin, key) : ''
  const copy = () => {
    void navigator.clipboard.writeText(command).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) }, () => undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Connect an agent</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">Let Claude Code or another agent work on your decks. Each key acts as you; keep them private. You can have up to {max}.</DialogDescription>
        {key && (
          <div className="mt-5 grid gap-2">
            <div className="flex items-start gap-2 rounded-lg border border-line-2 bg-panel p-3">
              <code className="min-w-0 flex-1 select-all break-all font-mono text-[12px] leading-[1.5] text-ink">{command}</code>
              <Button variant="outline" size="sm" onClick={copy} aria-label="Copy command">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</Button>
            </div>
            <p className="text-[12.5px] text-ink-3">You won’t see this key again.</p>
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
        <p className="mt-4 text-[12.5px] text-ink-3">Other agents: MCP over HTTP at <code className="font-mono">{location.origin}/mcp/v1</code>, header <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>.</p>
      </DialogContent>
    </Dialog>
  )
}
