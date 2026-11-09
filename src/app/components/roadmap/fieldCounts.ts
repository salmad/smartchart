import type { Issue } from '@/engine/roadmaps/types'

const live = (issues: Issue[]) => issues.filter((i) => i.deletedAt === null)

export function countFieldUse(issues: Issue[], fieldId: string): number {
  return live(issues).filter((i) => fieldId in i.fields).length
}

export function countOptionUse(issues: Issue[], fieldId: string, optionId: string): number {
  return live(issues).filter((i) => i.fields[fieldId] === optionId).length
}

export const newFieldId = () => `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const newOptionId = () => `o_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
