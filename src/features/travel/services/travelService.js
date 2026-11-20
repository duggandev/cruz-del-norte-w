import { request } from '../../../shared/api/http'

export async function getAvailability({ origen, destino, fecha }) {
  const params = new URLSearchParams({ origen, destino, fecha })
  return (await request(`/api/v1/viajes/disponibilidad?${params}`)).data
}

export async function getTripSeats(idViaje) {
  return (await request(`/api/v1/viajes/${idViaje}/asientos`)).data
}
