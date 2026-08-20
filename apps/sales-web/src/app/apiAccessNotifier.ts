export type ApiAccessStatus = 'UNAUTHENTICATED' | 'FORBIDDEN'

type ApiAccessListener = (status: ApiAccessStatus) => void

const listeners = new Set<ApiAccessListener>()

export function classifyApiAccess(status: number): ApiAccessStatus | null {
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  return null
}

export function notifyApiAccess(status: number): void {
  const classification = classifyApiAccess(status)
  if (!classification) return
  for (const listener of [...listeners]) listener(classification)
}

export function subscribeApiAccess(listener: ApiAccessListener): () => void {
  listeners.add(listener)
  let subscribed = true
  return () => {
    if (!subscribed) return
    subscribed = false
    listeners.delete(listener)
  }
}
