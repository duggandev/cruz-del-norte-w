import { request, rememberToken } from '../../../shared/api/http'

export async function login(usuario = 'ventas', password = 'ventas-demo') {
  const result = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usuario, password }),
  })
  rememberToken(result.data.access_token)
  return result.data
}
