import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { agentKey, connectCommand } from '@/app/agent-key'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

/** Connect an agent: make, replace or remove the account's key. A new key is shown once, with the Claude Code command. */
export function AgentKey({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [prefix, setPrefix] = useState<string | null>(null), [key, setKey] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false), [copied, setCopied] = useState(false), [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setKey(null); setConfirm(false); setError(null)
    void agentKey.get().then(setPrefix, () => setPrefix(null))
  }, [open])

  const make = () => { setError(null); agentKey.make().then((k) => { setKey(k); setPrefix(k.slice(0, 7)) }, (e: unknown) => setError(e instanceof Error ? e.message : 'Couldn’t make a key.')) }
  const remove = () => { void agentKey.remove().then(() => { setPrefix(null); setKey(null); setConfirm(false) }) }
  const command = key ? connectCommand(location.origin, key) : ''
  const copy = () => {
    void navigator.clipboard.writeText(command).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) }, () => undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Connect an agent</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">Let Claude Code or another agent work on your decks. The key acts as you; keep it private.</DialogDescription>
        {key && (
          <div className="mt-5 grid gap-2">
            <div className="flex items-start gap-2 rounded-lg border border-line-2 bg-panel p-3">
              <code className="min-w-0 flex-1 select-all break-all font-mono text-[12px] leading-[1.5] text-ink">{command}</code>
              <Button variant="outline" size="sm" onClick={copy} aria-label="Copy command">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</Button>
            </div>
            <p className="text-[12.5px] text-ink-3">You won’t see this key again.</p>
          </div>
        )}
        {!key && prefix && <p className="mt-5 text-[13px] text-ink-2">Key <span className="font-mono text-ink">{prefix}…</span> is active.</p>}
        {confirm && <p className="mt-3 text-[13px] text-ink-2">Remove the key? Connected agents stop working.</p>}
        {error && <p role="alert" className="mt-3 text-[13px] text-ink-2">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          {confirm
            ? <><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button onClick={remove}>Remove</Button></>
            : prefix
              ? <><Button variant="outline" onClick={() => setConfirm(true)}>Remove</Button><Button onClick={make}>Replace key</Button></>
              : <Button onClick={make}>Make a key</Button>}
        </div>
        <p className="mt-4 text-[12.5px] text-ink-3">Other agents: MCP over HTTP at <code className="font-mono">{location.origin}/mcp/v1</code>, header <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>.</p>
      </DialogContent>
    </Dialog>
  )
}
