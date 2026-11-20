import { request } from '../../../shared/api/http'

export async function createPayment(payload, idempotencyKey = crypto.randomUUID()) {
  return (await request('/api/v1/pagos', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  })).data
}

export async function getApprovedPayment(idReserva) {
  return (await request(`/api/v1/pagos/${idReserva}/aprobado`)).data
}
