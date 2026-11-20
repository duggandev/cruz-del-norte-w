# Cruz del Norte · Centro de operaciones

Dashboard React + Tailwind para operar los 7 dominios del gateway de Cruz del Norte. La UI está organizada por features y el cliente HTTP comparte autenticación, manejo de errores y URL base.

## Ejecutar

```bash
pnpm install
pnpm dev
```

La URL se configura en `.env` mediante `VITE_API_BASE_URL`. El valor inicial es `https://cruzdelnorte.duckdns.org`.

## Arquitectura

```text
src/
  features/
    auth/services/authService.js
    admin/services/adminService.js
    passengers/services/passengerService.js
    system/services/systemService.js
    travel/services/travelService.js
  shared/api/http.js
  main.jsx
```

El token que devuelve `POST /api/v1/auth/login` se guarda en `localStorage` como `cruz_token`; todas las solicitudes posteriores lo envían como Bearer.

## Verificación realizada el 20/11/2026

- `GET /health`: 200, `{"status":"ok"}`.
- `POST /api/v1/auth/login` con `ventas/ventas-demo`: 200 y `access_token` JWT.
- `GET /openapi/sc01.json` hasta `sc06.json`: 200.
- `GET /api/v1/admin/{viajes,reservas,pagos,pasajes,programaciones,pasajeros}`: 200.
- `GET /api/v1/pasajeros/politicas`: 200.
- `GET /api/v1/viajes/disponibilidad?origen=Lima&destino=Ica&fecha=2026-12-01`: 500. Conviene revisar la validación o el seed de viajes para esa combinación; el gateway y los contratos sí están disponibles.

## Endpoints recomendados para completar

La colección SC-01 a SC-06 cubre los flujos felices y algunos errores, pero para una aplicación operativa faltan endpoints de consulta y ciclo de vida:

| Dominio | Faltantes recomendados |
|---|---|
| Login | `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, recuperación/cambio de contraseña y roles/permisos explícitos |
| SC-01 Viajes | `GET /viajes`, `GET /viajes/{id}`, catálogo de rutas/orígenes/destinos, mapa de asientos, filtros/paginación y disponibilidad sin resultados consistente (`204`, no `500`) |
| SC-02 Reservas | `GET /reservas/{id}` para cliente, `PATCH/POST /reservas/{id}/cancelacion`, expiración automática de temporales y consulta paginada por pasajero/estado |
| SC-03 Pasajeros | `GET/PATCH /pasajeros/{dni}`, historial de validaciones y contrato de errores para DNI duplicado/no encontrado |
| SC-04 Pagos | `GET /pagos/{idTransaccion}`, webhook/reconciliación de pasarela, reembolso ejecutable (`POST /pagos/{id}/reembolso`) y listado paginado |
| SC-05 Pasajes | `GET /pasajes/{codigo}`, descarga PDF documentada en OpenAPI, reimpresión, cancelación/anulación y validación QR |
| SC-06 Flota | `GET /vehiculos`, `GET /vehiculos/{id}`, actualizar/cancelar programación, cerrar mantenimiento y bitácora de kilometraje/incidencias |
| Transversal | paginación, filtros, `request-id`, formato de error uniforme, idempotencia documentada y métricas/health por servicio |

Además, los endpoints `/api/v1/admin/*` actualmente responden un estado general del sistema. Para el panel administrativo deberían devolver colecciones reales con filtros, paginación y totales.

## Flujo de venta en ventanilla

1. El operador inicia sesión con el rol `VENTANILLA` (`ventas / ventas-demo`).
2. Busca origen, destino y fecha mediante SC-01.
3. Selecciona una salida y un asiento.
4. Ingresa DNI, nombres y apellidos; se valida con SC-03.
5. Se crea la reserva temporal con SC-02.
6. Se procesa el pago con una clave `Idempotency-Key` mediante SC-04.
7. Solo si el pago queda `APROBADO`, se emite el pasaje con SC-05 y se muestra/descarga el PDF.

Si disponibilidad devuelve un error o el backend aún no tiene datos para una fecha, la pantalla informa el problema y muestra resultados demo para poder recorrer el flujo visualmente; las llamadas de reserva, pago y emisión siguen apuntando al gateway real.
