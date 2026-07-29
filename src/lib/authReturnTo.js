export function safeReturnTo() {
  if (typeof window === 'undefined') {
    return '/'
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get('returnTo') || '/'
    if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) {
      return '/'
    }
    return returnTo
  } catch {
    return '/'
  }
}
