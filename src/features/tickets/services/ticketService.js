import { request } from '../../../shared/api/http'

export async function issueTicket(payload) {
  return (await request('/api/v1/pasajes', { method: 'POST', body: JSON.stringify(payload) })).data
}
