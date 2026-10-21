/* Sidebar actions that show at once and are sent behind the scenes. A pending action is an `Op`: a change to one list's
   rows, laid over every list read from the server until its request has settled, so a refetch that still has a deleted
   row cannot bring it back. Requests for one row go out in the order they were made. */

export interface Op<R extends { id: string }> {
  /** The stored list this change belongs to (`decks:<workspace>`); other lists are left alone. */
  list: string
  row: string
  apply(rows: R[]): R[]
}

/** The rows with every pending change for this list applied, oldest first. */
export function overlay<R extends { id: string }>(list: string, rows: R[], ops: readonly Op<R>[]): R[] {
  return ops.reduce((all, op) => (op.list === list ? op.apply(all) : all), rows)
}

export interface Ordered {
  /** Sends after everything already queued for this row has settled, whether it worked or not. Gives back this send's own result. */
  run<T>(row: string, send: () => Promise<T>): Promise<T>
  /** Resolves once nothing is queued for this row. */
  wait(row: string): Promise<void>
}

export function ordered(): Ordered {
  const tails = new Map<string, Promise<void>>()
  return {
    run(row, send) {
      const result = (tails.get(row) ?? Promise.resolve()).then(send)
      const tail = result.then(() => undefined, () => undefined)
      tails.set(row, tail)
      void tail.then(() => { if (tails.get(row) === tail) tails.delete(row) })
      return result
    },
    wait: (row) => tails.get(row) ?? Promise.resolve(),
  }
}
