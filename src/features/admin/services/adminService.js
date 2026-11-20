import { request } from '../../../shared/api/http'

export async function getAdminStatus(resource) {
  return (await request(`/api/v1/admin/${resource}`)).data
}

export async function createAdminTrip(payload) {
  return (await request('/api/v1/admin/viajes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })).data
}
