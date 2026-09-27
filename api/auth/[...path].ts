// Neon Auth through our own origin: sign-in, sessions and sign-out, with first-party cookies.
import { proxyAuth } from '../_lib/auth'

export const GET = proxyAuth, POST = proxyAuth
