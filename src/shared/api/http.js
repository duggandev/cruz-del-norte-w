export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://cruzdelnorte.duckdns.org'

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  const token = localStorage.getItem('cruz_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  const raw = await response.text()
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  if (!response.ok) {
    const error = new Error(data?.mensaje || data?.detail || `Error ${response.status} en ${path}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return { data, status: response.status, headers: response.headers }
}

export function rememberToken(token) {
  if (token) localStorage.setItem('cruz_token', token)
}
