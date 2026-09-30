import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { routeFor } from '../../vite/api-dev'

const names = readdirSync('api', { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.ts')).map((e) => ({ name: e.name.slice(0, -3) }))

describe('dev API routes come from api/ and vercel.json', () => {
  it.each(names)('/api/$name is served by its file in api/', ({ name }) => {
    expect(routeFor(`/api/${name}`)).toMatch(new RegExp(`api/${name}\\.ts$`))
  })
  it('applies the rewrites in vercel.json, so nested auth paths reach api/auth.ts', () => {
    expect(routeFor('/api/auth/sign-in/social')).toMatch(/api\/auth\.ts$/)
    expect(routeFor('/api/auth/get-session')).toMatch(/api\/auth\.ts$/)
  })
  it('does not serve private folders, unknown paths or paths that climb out of api/', () => {
    expect(routeFor('/api/_lib/auth')).toBeUndefined()
    expect(routeFor('/api/nope')).toBeUndefined()
    expect(routeFor('/api/../package')).toBeUndefined()
    expect(routeFor('/')).toBeUndefined()
  })
})
