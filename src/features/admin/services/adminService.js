import { request } from '../../../shared/api/http'

export async function getAdminStatus(resource) {
  return (await request(`/api/v1/admin/${resource}`)).data
}
