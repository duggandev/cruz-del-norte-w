import { request } from '../../../shared/api/http'

export async function getPolicies() {
  return (await request('/api/v1/pasajeros/politicas')).data
}

export async function validatePassenger(payload) {
  return (await request('/api/v1/pasajeros/validaciones', { method: 'POST', body: JSON.stringify(payload) })).data
}

const DNI_API_URL = import.meta.env.VITE_DNI_API_URL || 'https://api.apiperu.pe'

export async function lookupDni(dni) {
  const response = await fetch(`${DNI_API_URL}/dni`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_DNI_API_TOKEN}`,
      'X-API-Key': import.meta.env.VITE_DNI_API_KEY,
    },
    body: JSON.stringify({ dni }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `No se encontró el DNI ${dni}`)
  }
  return data.data
}
