import { API_BASE_URL, request } from '../../../shared/api/http'

const services = [
  { key: 'auth', label: 'Auth', openapi: null },
  { key: 'sc01', label: 'SC-01 · Viajes', openapi: '/openapi/sc01.json' },
  { key: 'sc02', label: 'SC-02 · Reservas', openapi: '/openapi/sc02.json' },
  { key: 'sc03', label: 'SC-03 · Pasajeros', openapi: '/openapi/sc03.json' },
  { key: 'sc04', label: 'SC-04 · Pagos', openapi: '/openapi/sc04.json' },
  { key: 'sc05', label: 'SC-05 · Pasajes', openapi: '/openapi/sc05.json' },
  { key: 'sc06', label: 'SC-06 · Flota', openapi: '/openapi/sc06.json' },
]

export async function checkGateway() {
  const result = await request('/health')
  return result.data
}

export async function checkContracts() {
  return Promise.all(services.filter(s => s.openapi).map(async service => {
    try {
      const result = await fetch(`${API_BASE_URL}${service.openapi}`)
      const data = await result.json()
      return { ...service, online: result.ok, paths: Object.keys(data.paths || {}) }
    } catch (error) {
      return { ...service, online: false, paths: [], error: error.message }
    }
  }))
}
