const KEY = 'smartchart.chatModelTip.dismissed'

export function chatModelTipDismissed(storage?: Pick<Storage, 'getItem'>): boolean {
  try { return (storage ?? localStorage).getItem(KEY) === '1' } catch { return true }
}

export function dismissChatModelTip(storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? localStorage).setItem(KEY, '1') } catch { /* storage blocked */ }
}
