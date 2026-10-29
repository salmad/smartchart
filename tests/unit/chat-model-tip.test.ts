import { describe, expect, it } from 'vitest'
import { chatModelTipDismissed, dismissChatModelTip } from '../../src/app/chat-model-tip'

describe('chat model tip', () => {
  it('starts visible and stays dismissed after dismiss', () => {
    const s = { store: {} as Record<string, string>, getItem(k: string) { return this.store[k] ?? null }, setItem(k: string, v: string) { this.store[k] = v } }
    expect(chatModelTipDismissed(s)).toBe(false)
    dismissChatModelTip(s)
    expect(chatModelTipDismissed(s)).toBe(true)
  })
})
