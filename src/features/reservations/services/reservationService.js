import { request } from '../../../shared/api/http'

export async function createReservation(payload) {
  return (await request('/api/v1/reservas', { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function createMultipleReservations(payload) {
  return (await request('/api/v1/reservas/multiples', { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function getReservationStatus(idReserva) {
  return (await request(`/api/v1/reservas/${idReserva}`)).data
}

export async function releaseReservation(idReserva) {
  return (await request(`/api/v1/reservas/${idReserva}/liberacion`, { method: 'POST' })).data
}
