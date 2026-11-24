import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, ArrowUpRight, BusFront, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardList, Clock3, CreditCard, Download, FileText, LayoutDashboard,
  LogIn, LogOut, Menu, MoreHorizontal, Search, Settings2, ShieldCheck, Ticket,
  UserRound, UsersRound, Wrench, X, Zap
} from 'lucide-react'
import './styles.css'
import { login } from './features/auth/services/authService'
import { checkContracts, checkGateway } from './features/system/services/systemService'
import { getAdminStatus } from './features/admin/services/adminService'
import { getAvailability, getTripSeats } from './features/travel/services/travelService'
import { lookupDni, validatePassenger } from './features/passengers/services/passengerService'
import { createMultipleReservations, createReservation, getReservationStatus, holdSeat, updateReservationPassenger, releaseReservation } from './features/reservations/services/reservationService'
import { createPayment, getApprovedPayment } from './features/payments/services/paymentService'
import { issueTicket } from './features/tickets/services/ticketService'
import { API_BASE_URL } from './shared/api/http'
import { subscribeSeatLocks } from './shared/supabase'

const nav = [
  { label: 'Ventanilla', icon: Ticket },
  { label: 'Viajes', icon: BusFront },
  { label: 'Reservas', icon: ClipboardList },
  { label: 'Pasajeros', icon: UsersRound },
  { label: 'Pagos', icon: CreditCard },
  { label: 'Pasajes', icon: Ticket },
]

const adminResourceByView = { Viajes: 'viajes', Reservas: 'reservas', Pasajeros: 'pasajeros', Pagos: 'pagos', Pasajes: 'pasajes' }
const routeByView = { Ventanilla: '/ventanilla', Viajes: '/viajes', Reservas: '/reservas', Pasajeros: '/pasajeros', Pagos: '/pagos', Pasajes: '/pasajes' }
const viewFromPath = path => Object.entries(routeByView).find(([, route]) => path === route)?.[0] || 'Ventanilla'

const getTodayInputValue = () => {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localNow.toISOString().slice(0, 10)
}

const journeys = [
  { route: 'Lima → Ica', time: '06:30', platform: 'Andén 02', seats: '18 asientos', status: 'A tiempo', color: 'mint' },
  { route: 'Lima → Trujillo', time: '08:15', platform: 'Andén 05', seats: '07 asientos', status: 'A tiempo', color: 'mint' },
  { route: 'Ica → Lima', time: '09:45', platform: 'Andén 01', seats: '03 asientos', status: 'Alta demanda', color: 'amber' },
  { route: 'Lima → Arequipa', time: '11:20', platform: 'Andén 08', seats: '22 asientos', status: 'A tiempo', color: 'mint' },
]

const apiGroups = [
  { name: 'Auth', count: 1, tone: 'teal', endpoints: ['POST /api/v1/auth/login'] },
  { name: 'SC-01 · Viajes', count: 1, tone: 'blue', endpoints: ['GET /api/v1/viajes/disponibilidad'] },
  { name: 'SC-02 · Reservas', count: 2, tone: 'violet', endpoints: ['POST /api/v1/reservas', 'POST /api/v1/reservas/:id/liberacion'] },
  { name: 'SC-03 · Pasajeros', count: 2, tone: 'orange', endpoints: ['POST /api/v1/pasajeros/validaciones', 'GET /api/v1/pasajeros/politicas'] },
  { name: 'SC-04 · Pagos', count: 1, tone: 'green', endpoints: ['POST /api/v1/pagos'] },
  { name: 'SC-05 · Pasajes', count: 2, tone: 'pink', endpoints: ['POST /api/v1/pasajes', 'GET /documentos/:codigo.pdf'] },
  { name: 'SC-06 · Flota', count: 1, tone: 'slate', endpoints: ['POST /api/v1/programaciones'] },
]

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cruz_session') || 'null') } catch { return null }
  })
  const [active, setActive] = useState(() => viewFromPath(window.location.pathname))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [connected, setConnected] = useState(false)
  const [contractStatus, setContractStatus] = useState([])
  const [showApi, setShowApi] = useState(false)
  const [sale, setSale] = useState(null)
  useEffect(() => {
    checkGateway().then(() => setConnected(true)).catch(() => setConnected(false))
    checkContracts().then(setContractStatus)
  }, [])
  useEffect(() => {
    const onPopState = () => setActive(viewFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const connectGateway = async () => {
    try {
      await login()
      setConnected(true)
      setShowApi(false)
    } catch {
      // El panel sigue funcionando en modo demo si las credenciales no están disponibles.
      setConnected(false)
    }
  }
  const handleLogin = async ({ usuario, password, role }) => {
    const result = await login(usuario, password)
    const next = { usuario, role, token: result.access_token }
    localStorage.setItem('cruz_session', JSON.stringify(next))
    setSession(next)
    window.history.replaceState({}, '', routeByView.Ventanilla)
    setActive('Ventanilla')
  }
  const logout = () => {
    localStorage.removeItem('cruz_token')
    localStorage.removeItem('cruz_session')
    setSession(null)
    window.history.pushState({}, '', '/login')
  }
  const filtered = useMemo(() => journeys.filter(x => `${x.route} ${x.platform}`.toLowerCase().includes(query.toLowerCase())), [query])

  if (!session) return <LoginScreen onLogin={handleLogin} />
  const visibleNav = session?.role === 'VENTANILLA'
    ? nav.filter(item => item.label !== 'Viajes')
    : nav
  const profileName = session?.role === 'VENTANILLA' ? 'Ventanilla' : 'Jorge Paredes'
  const profileRole = session?.role === 'VENTANILLA' ? 'Operador de ventanilla' : 'Administrador'
  const profileInitials = session?.role === 'VENTANILLA' ? 'VE' : 'JP'

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><BusFront size={20} strokeWidth={2.3} /></div><div><strong>Cruz del Norte</strong><span>Centro de operaciones</span></div></div>
      <div className="workspace-label">Workspace <ChevronDown size={14} /></div>
      <nav>{visibleNav.map(item => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => { window.history.pushState({}, '', routeByView[item.label]); setActive(item.label); setSidebarOpen(false) }}><Icon size={18} /><span>{item.label}</span>{item.label === 'Reservas' && <b className="nav-badge">12</b>}</button> })}</nav>
      <div className="sidebar-bottom"><div className="health-card"><div className="health-top"><span className="pulse"></span><span>Estado del sistema</span><span className="health-ok">Operativo</span></div><div className="health-bar"><i></i></div><small>7 microservicios monitoreados</small></div><button className="nav-item"><Settings2 size={18} /><span>Configuración</span></button><button className="nav-item"><CircleHelp size={18} /><span>Centro de ayuda</span></button><div className="profile"><div className="avatar">{profileInitials}</div><div><strong>{profileName}</strong><span>{profileRole}</span></div><MoreHorizontal size={18} /></div></div>
    </aside>
    {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><div className="breadcrumbs"><span>Operaciones</span><span>/</span><strong>{active}</strong></div><div className="top-actions"><div className="search-box"><Search size={17} /><input placeholder="Buscar en el sistema" value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌘ K</kbd></div><button className="icon-button"><Activity size={19} /><i className="notification-dot"></i></button><div className="top-avatar">{profileInitials}</div><button className="icon-button" title="Cerrar sesión" onClick={logout}><LogOut size={18} /></button></div></header>
      <div className="page-wrap">
        {active === 'Ventanilla' ? <SalesDesk sale={sale} setSale={setSale} /> : <OperationalView view={active} resource={adminResourceByView[active]} />}
      </div>
    </main>
    {showApi && <ApiModal onClose={() => setShowApi(false)} onConnect={connectGateway} contractStatus={contractStatus} />}
  </div>
}

function OperationalView({ view, resource }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  useEffect(() => { let mounted = true; setLoading(true); setError(''); getAdminStatus(resource).then(data => mounted && setResult(data)).catch(e => mounted && setError(e.message)).finally(() => mounted && setLoading(false)); return () => { mounted = false } }, [resource])
  useEffect(() => setPage(1), [resource, pageSize, search])
  useEffect(() => {
    if (!resource) return undefined
    const head = document.querySelector('.records-head')
    if (!head || head.querySelector('.records-search')) return undefined
    const wrapper = document.createElement('label')
    wrapper.className = 'records-search'
    wrapper.innerHTML = '<span class="records-search-icon">⌕</span><input placeholder="Buscar por DNI, nombre, estado o código" />'
    const input = wrapper.querySelector('input')
    input.value = search
    input.oninput = event => setSearch(event.target.value)
    const connection = head.querySelector('.connection-label')
    head.insertBefore(wrapper, connection || null)
    return () => wrapper.remove()
  }, [view, resource])
  const records = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : Array.isArray(result?.data) ? result.data : (result?.data && typeof result.data === 'object' ? [result.data] : result && (result.id || result.codigo || result.estado) ? [result] : null)
  const columns = view === 'Pagos' ? ['codigo', 'importe', 'medioPago', 'estado', 'createdAt'] : view === 'Pasajeros' ? ['dni', 'nombreCompleto', 'estado', 'codigo'] : view === 'Pasajes' ? ['codigo', 'estado', 'documentoUrl', 'fechaEmision'] : view === 'Reservas' ? ['idReserva', 'idViaje', 'numeroAsiento', 'piso', 'estado', 'dni', 'vencimiento'] : ['estado', 'codigo', 'createdAt']
  const labels = { idReserva: 'Reserva', idViaje: 'Viaje', idAsiento: 'ID asiento', numeroAsiento: 'Asiento', piso: 'Piso', codigo: 'Código', importe: 'Importe', monto: 'Importe', medioPago: 'Medio de pago', estado: 'Estado', createdAt: 'Fecha', fechaEmision: 'Fecha de emisión', vencimiento: 'Vencimiento', documentoUrl: 'Documento', dni: 'DNI', nombreCompleto: 'Pasajero' }
  const valueFor = (row, column) => { if (column === 'importe') { const amount = row.importe ?? row.monto; return amount === undefined || amount === null ? '—' : `S/ ${Number(amount).toFixed(2)}` }; if (['createdAt', 'fechaEmision', 'fecha', 'fechaCreacion', 'vencimiento'].includes(column) && row[column]) return new Date(row[column]).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }); return row[column] ?? '—' }
  const filteredRecords = records ? records.filter(row => {
    if (!search.trim()) return true
    const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return normalized(Object.values(row).join(' ')).includes(normalized(search))
  }) : []
  const totalPages = records ? Math.max(1, Math.ceil(filteredRecords.length / pageSize)) : 1
  const visibleRecords = records ? filteredRecords.slice((page - 1) * pageSize, page * pageSize) : []
  return <section className="records-page"><div className="records-head"><div><p className="eyebrow">OPERACIÓN · {view.toUpperCase()}</p><h1>{view === 'Pasajes' ? 'Pasajes vendidos' : view}</h1><p className="subtext">Consulta los registros entregados por el servicio administrativo.</p></div><span className="connection-label online"><i></i>API conectada</span></div><div className="panel records-panel">{loading ? <div className="records-empty"><Activity className="spin" size={24} /><strong>Cargando registros…</strong></div> : error ? <div className="records-empty"><X size={24} /><strong>No se pudo cargar {view.toLowerCase()}</strong><p>{error}</p></div> : records ? <><div className="table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{labels[column] || column}</th>)}</tr></thead><tbody>{visibleRecords.length ? visibleRecords.map((row, index) => <tr key={row.id || row.idReserva || row.codigo || index}>{columns.map(column => <td key={column}>{column === 'documentoUrl' && row[column] ? <a href={row[column]} target="_blank" rel="noreferrer" className="text-button">Descargar <Download size={13} /></a> : String(valueFor(row, column))}</td>)}</tr>) : <tr><td colSpan={columns.length}>No hay registros disponibles.</td></tr>}</tbody></table></div>{records.length > 0 && <div className="pagination"><span>{records.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, records.length)} de ${records.length} ${view.toLowerCase()}` : `0 ${view.toLowerCase()}`}</span><label>Mostrar<select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={15} /></button><strong>Página {page} de {totalPages}</strong><button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={15} /></button></div>}</> : <div className="records-empty"><FileText size={24} /><strong>El endpoint aún no entrega registros</strong><p>La API respondió correctamente, pero `/api/v1/admin/{resource}` devuelve un estado general en lugar de una colección. Cuando retorne un arreglo, esta vista lo mostrará automáticamente.</p><pre>{JSON.stringify(result, null, 2)}</pre></div>}</div></section>
}

function LoginScreen({ onLogin }) {
  const [role, setRole] = useState('VENTANILLA')
  const [usuario, setUsuario] = useState('ventas')
  const [password, setPassword] = useState('ventas-demo')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true)
    try { await onLogin({ usuario, password, role }) } catch (e) { setError(e.message || 'No se pudo iniciar sesión') } finally { setLoading(false) }
  }
  return <div className="login-screen"><div className="login-aside"><div className="brand login-brand"><div className="brand-mark"><BusFront size={20} /></div><div><strong>Cruz del Norte</strong><span>Centro de operaciones</span></div></div><div className="login-quote"><p>“Cada viaje empieza con una buena atención.”</p><span>Plataforma de venta y operación</span></div><div className="login-aside-foot"><ShieldCheck size={15} /> Gateway protegido · 7 servicios</div></div><div className="login-card-wrap"><form className="login-card" onSubmit={submit}><div className="mobile-login-logo"><div className="brand-mark"><BusFront size={20} /></div></div><p className="eyebrow">ACCESO SEGURO</p><h1>Bienvenido de nuevo</h1><p className="login-subtitle">Ingresa a tu espacio de trabajo para continuar.</p><div className="role-switch"><button type="button" className={role === 'VENTANILLA' ? 'selected' : ''} onClick={() => { setRole('VENTANILLA'); setUsuario('ventas'); setPassword('ventas-demo') }}><Ticket size={16} /><span><strong>Ventanilla</strong><small>Venta de pasajes</small></span></button><button type="button" className={role === 'ADMIN' ? 'selected' : ''} onClick={() => { setRole('ADMIN'); setUsuario('admin'); setPassword('') }}><ShieldCheck size={16} /><span><strong>Administrador</strong><small>Control total</small></span></button></div><label>Usuario<input value={usuario} onChange={e => setUsuario(e.target.value)} autoComplete="username" /></label><label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>{error && <div className="login-error">{error}</div>}<button className="primary-button login-submit" disabled={loading}>{loading ? 'Conectando…' : <><LogIn size={16} /> Ingresar al sistema</>}</button><p className="login-help">Para pruebas de ventanilla: <code>ventas / ventas-demo</code></p></form></div></div>
}

function SalesDeskLegacy({ sale, setSale }) {
  const current = sale || { step: 1, origen: 'Lima', destino: 'Ica', fecha: getTodayInputValue(), dni: '', nombres: '', apellidos: '', idViaje: '', idAsiento: '', importe: '', reservation: null, payment: null, ticket: null, trips: null, busy: false, message: '' }
  const update = patch => setSale({ ...current, ...patch })
  const searchTrips = async e => { e.preventDefault(); update({ busy: true, message: '' }); try { const result = await getAvailability(current); update({ trips: result.viajes || [], step: 2, busy: false }) } catch (error) { update({ trips: [], step: 2, busy: false, message: error.message || 'No se pudieron cargar las salidas para la fecha seleccionada.' }) } }
  const chooseTrip = trip => update({ idViaje: trip.idViaje, importe: trip.tarifa, idAsiento: trip.asientosDisponibles?.[0] || 1, selectedTrip: trip, step: 3 })
  const findPassengerByDni = async () => {
    if (!/^\d{8}$/.test(current.dni)) return
    update({ busy: true, message: '' })
    try {
      const person = await lookupDni(current.dni)
      update({ nombres: person.nombres || '', apellidos: [person.apellido_paterno, person.apellido_materno].filter(Boolean).join(' '), busy: false, message: '' })
    } catch (error) {
      update({ busy: false, message: error.message })
    }
  }
  const validate = async e => { e.preventDefault(); update({ busy: true, message: '' }); try { const person = await lookupDni(current.dni); const nombres = person.nombres || current.nombres; const apellidos = [person.apellido_paterno, person.apellido_materno].filter(Boolean).join(' ') || current.apellidos; await validatePassenger({ dni: current.dni, nombres, apellidos }); update({ nombres, apellidos, step: 4, busy: false }) } catch (error) { update({ busy: false, message: error.message || 'No se pudo validar el pasajero.' }) } }
  const reserve = async () => { update({ busy: true, message: '' }); try { const reservation = await createReservation({ idViaje: current.idViaje, idAsiento: Number(current.idAsiento), idCanal: 1, pasajero: { dni: current.dni, nombres: current.nombres, apellidos: current.apellidos } }); update({ reservation, step: 5, busy: false }) } catch (error) { update({ busy: false, message: error.message || 'No se pudo crear la reserva.' }) } }
  const pay = async () => { update({ busy: true, message: '' }); try { const payment = await createPayment({ idReserva: current.reservation.idReserva, importe: current.importe, medioPago: 'PASARELA', tokenPasarela: 'mock_aprobado' }); const ticket = await issueTicket({ idReserva: current.reservation.idReserva, idTransaccion: payment.idTransaccion }); update({ payment, ticket, step: 6, busy: false }) } catch (error) { update({ busy: false, message: error.message || 'No se pudo completar el pago o emitir el pasaje.' }) } }
  const reset = () => setSale(null)
  useEffect(() => {
    if (current.step !== 2 && current.step !== 5) return undefined
    const panel = document.querySelector('.sale-main')
    if (!panel) return undefined
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'secondary-button workflow-back'
    button.textContent = '← Atrás'
    button.onclick = () => setSale(previous => ({ ...previous, step: Math.max(1, previous.step - 1) }))
    panel.appendChild(button)
    return () => button.remove()
  }, [current.step, setSale])
  useEffect(() => {
    if (current.step !== 3) return undefined
    const input = document.querySelector('input[placeholder="74859621"]')
    if (!input) return undefined
    const handleBlur = async () => {
      if (!/^\d{8}$/.test(input.value)) return
      try {
        const person = await lookupDni(input.value)
        const nombres = person.nombres || ''
        const apellidos = [person.apellido_paterno, person.apellido_materno].filter(Boolean).join(' ')
        setSale(previous => ({ ...previous, nombres, apellidos, busy: false, message: '' }))
      } catch (error) {
        setSale(previous => ({ ...previous, busy: false, message: error.message }))
      }
    }
    input.addEventListener('blur', handleBlur)
    return () => input.removeEventListener('blur', handleBlur)
  }, [current.step, setSale])
  return <section className="sales-desk"><div className="sales-head"><div><p className="eyebrow">MÓDULO DE VENTANILLA</p><h1>Vender un pasaje</h1><p className="subtext">Acompaña al cliente desde la búsqueda hasta la entrega de su documento.</p></div><div className="counter-chip"><span className="pulse"></span> Caja 04 · En línea</div></div><div className="stepper">{['Viaje', 'Asiento', 'Pasajero', 'Reserva', 'Pago', 'Pasaje'].map((label, i) => <div className={`step ${current.step > i + 1 ? 'done' : ''} ${current.step === i + 1 ? 'current' : ''}`} key={label}><span>{current.step > i + 1 ? '✓' : i + 1}</span><small>{label}</small></div>)}</div><div className="sale-layout"><div className="panel sale-main">{current.step === 1 && <form className="sale-form" onSubmit={searchTrips}><FormTitle title="¿A dónde viaja el cliente?" desc="Busca salidas y disponibilidad en tiempo real." /><div className="form-grid"><label>Origen<select value={current.origen} onChange={e => update({ origen: e.target.value })}><option>Lima</option><option>Ica</option><option>Trujillo</option><option>Arequipa</option></select></label><label>Destino<select value={current.destino} onChange={e => update({ destino: e.target.value })}><option>Ica</option><option>Lima</option><option>Trujillo</option><option>Arequipa</option></select></label><label>Fecha de viaje<input type="date" value={current.fecha} onChange={e => update({ fecha: e.target.value })} /></label></div><div className="sale-actions"><button className="primary-button" disabled={current.busy}>{current.busy ? 'Consultando…' : <>Buscar salidas <ArrowUpRight size={15} /></>}</button></div></form>}{current.step === 2 && <div className="sale-form"><FormTitle title="Elige una salida" desc={`${current.origen} → ${current.destino} · ${current.fecha}`} /><div className="trip-options">{current.trips.map((trip, i) => <button className="trip-option" key={trip.idViaje || i} onClick={() => chooseTrip(trip)}><span className="trip-time">{trip.horaSalida || trip.hora || journeys[i % journeys.length].time}</span><span><strong>Bus Cruz del Norte</strong><small>{trip.asientosDisponibles?.length || 0} asientos disponibles</small></span><b>S/ {trip.tarifa}</b><ArrowUpRight size={15} /></button>)}</div>{current.message && <div className="sale-note">{current.message}</div>}</div>}{current.step === 3 && <form className="sale-form" onSubmit={validate}><FormTitle title="Datos del pasajero" desc="Validamos la identidad antes de reservar." /><div className="form-grid"><label>DNI<input required value={current.dni} onChange={e => update({ dni: e.target.value })} placeholder="74859621" /></label><label>Nombres<input required value={current.nombres} onChange={e => update({ nombres: e.target.value })} placeholder="Nombres" /></label><label>Apellidos<input required value={current.apellidos} onChange={e => update({ apellidos: e.target.value })} placeholder="Apellidos" /></label></div><div className="sale-summary"><Ticket size={18} /><span>{current.origen} → {current.destino}</span><b>S/ {current.importe}</b></div><div className="sale-actions"><button type="button" className="secondary-button" onClick={() => update({ step: 2 })}>Atrás</button><button className="primary-button" disabled={current.busy}>{current.busy ? 'Validando…' : 'Validar pasajero'}</button></div>{current.message && <div className="sale-note error">{current.message}</div>}</form>}{current.step === 4 && <div className="sale-form"><FormTitle title="Reserva temporal" desc="Confirma el asiento antes de pasar al cobro." /><div className="reservation-review"><div><small>Pasajero</small><strong>{current.nombres} {current.apellidos}</strong><span>DNI {current.dni}</span></div><div><small>Viaje</small><strong>{current.origen} → {current.destino}</strong><span>Asiento {current.idAsiento} · S/ {current.importe}</span></div></div><div className="sale-note success"><ShieldCheck size={16} /> Pasajero validado correctamente. La reserva se mantendrá temporal mientras realizas el pago.</div><div className="sale-actions"><button className="secondary-button" onClick={() => update({ step: 3 })}>Atrás</button><button className="primary-button" onClick={reserve} disabled={current.busy}>{current.busy ? 'Reservando…' : 'Confirmar reserva'}</button></div>{current.message && <div className="sale-note error">{current.message}</div>}</div>}{current.step === 5 && <div className="sale-form"><FormTitle title="Cobrar y emitir" desc="Registra el pago aprobado y emite el pasaje automáticamente." /><div className="payment-card"><div className="payment-label"><CreditCard size={19} /><span>Pago con pasarela</span><strong>S/ {current.importe}</strong></div><p>La API usa una clave de idempotencia para evitar cobros duplicados.</p></div><div className="sale-actions"><button className="primary-button" onClick={pay} disabled={current.busy}>{current.busy ? 'Procesando…' : 'Cobrar y emitir pasaje'}</button></div>{current.message && <div className="sale-note error">{current.message}</div>}</div>}{current.step === 6 && <div className="sale-form success-screen"><div className="success-mark"><ShieldCheck size={28} /></div><FormTitle title="Pasaje emitido" desc="La venta se completó correctamente." /><div className="ticket-code"><small>Código del pasaje</small><strong>{current.ticket?.codigo || 'CN-DEMO-20481'}</strong><span>{current.origen} → {current.destino} · {current.nombres} {current.apellidos}</span></div><div className="sale-actions"><button className="secondary-button" onClick={reset}>Nueva venta</button>{current.ticket?.documentoUrl ? <a className="primary-button" href={current.ticket.documentoUrl} target="_blank" rel="noreferrer"><Download size={15} /> Descargar PDF</a> : <button className="primary-button"><Download size={15} /> Descargar comprobante</button>}</div></div>}</div><aside className="panel sale-sidebar"><h2>Seguimiento de la venta</h2><p>El cliente pasa por estos estados</p><StatusLine number="01" title="Datos del viaje" active={current.step >= 1} done={current.step > 1} /><StatusLine number="02" title="Pasajero validado" active={current.step >= 3} done={current.step > 3} /><StatusLine number="03" title="Reserva temporal" active={current.step >= 4} done={current.step > 4} /><StatusLine number="04" title="Pago aprobado" active={current.step >= 5} done={current.step > 5} /><StatusLine number="05" title="Pasaje emitido" active={current.step >= 6} done={current.step >= 6} /><div className="sale-help"><CircleHelp size={16} /><span>Si el pago queda pendiente, no emitas el pasaje. Puedes consultar el estado desde Pagos.</span></div></aside></div></section>
}

function SalesDesk({ sale, setSale }) {
  const current = sale || { step: 1, origen: 'Lima', destino: 'Ica', fecha: getTodayInputValue(), trips: [], selectedTrip: null, selectedSeats: [], passengers: [], reservations: [], reservationStatuses: [], tickets: [], busy: false, message: '' }
  const seatToken = seat => Number(seat?.piso || 1) * 1000 + Number(seat?.idAsiento || 0)
  const update = patch => setSale({ ...current, ...patch })
  const searchTrips = async event => {
    event.preventDefault()
    update({ busy: true, message: '' })
    try {
      const result = await getAvailability(current)
      update({ trips: Array.isArray(result) ? result : result?.viajes || [], step: 2, busy: false })
    } catch (error) {
      update({ trips: [], step: 2, busy: false, message: error.message || 'No se pudieron cargar las salidas.' })
    }
  }
  const chooseTrip = async trip => {
    update({ busy: true, message: '' })
    try {
      const map = await getTripSeats(trip.idViaje)
      const seatDetails = (map?.asientos || []).map(seat => ({ ...seat, idAsiento: seat.idAsiento ?? seat.id ?? seat.numero })).filter(seat => seat.idAsiento)
      const expectedByFloor = map?.asientosPorPiso || {}
      Object.entries(expectedByFloor).forEach(([floorKey, expected]) => {
        const floor = Number(floorKey)
        const floorSeats = seatDetails.filter(seat => Number(seat.piso || 1) === floor)
        const currentNumbers = new Set(floorSeats.map(seat => Number(seat.numero ?? seat.idAsiento)))
        const columns = Number(map?.columnasPorPiso?.[floorKey] || floorSeats[0]?.columnas || 4)
        for (let numero = 1; numero <= Number(expected); numero += 1) {
          if (currentNumbers.has(numero)) continue
          const fila = Math.floor((numero - 1) / columns) + 1
          const columnaNumero = ((numero - 1) % columns) + 1
          seatDetails.push({ idAsiento: -(floor * 1000 + numero), numero, piso: floor, fila, columnaNumero, columnas: columns, estado: 'NO_CONFIGURADO', disponible: false, sintetico: true })
        }
      })
      const seats = seatDetails.map(seat => seatToken(seat))
      update({ selectedTrip: { ...trip, tipoBus: map.tipoBus, pisos: map.pisos, capacidad: map.capacidad, columnasPorPiso: map.columnasPorPiso, tarifaBase: map.tarifaBase ?? trip.tarifa, seats, seatDetails }, selectedSeats: [], passengers: [], step: 2, busy: false, message: seats.length ? '' : 'La API no devolvió asientos para esta salida.' })
    } catch (error) {
      update({ selectedTrip: null, busy: false, message: error.message || 'No se pudo cargar el mapa de asientos.' })
    }
  }
  const toggleSeat = async seat => {
    const details = current.selectedTrip?.seatDetails || []
    const metadata = details.find(item => seatToken(item) === seat)
    const isSelected = current.selectedSeats.includes(seat)
    if (!isSelected && metadata?.estado && metadata.estado !== 'DISPONIBLE') return
    if (isSelected) {
      const reservation = current.reservations.find(item => item.idAsiento === metadata?.idAsiento)
      if (reservation) {
        try { await releaseReservation(reservation.idReserva) } catch (error) { return update({ message: error.message || 'No se pudo liberar el asiento.' }) }
      }
    } else {
      if (current.selectedSeats.length >= 10) return
      try {
        const reservation = await holdSeat({ idViaje: current.selectedTrip.idViaje, idAsiento: metadata.idAsiento, idCanal: 1 })
        const reservations = [...current.reservations, reservation]
        const selected = [...current.selectedSeats, seat]
        const passengers = selected.map(token => {
          const item = details.find(detail => seatToken(detail) === token)
          return current.passengers.find(passenger => passenger.seatToken === token) || { seatToken: token, idAsiento: item?.idAsiento, piso: item?.piso, dni: '', nombres: '', apellidos: '' }
        })
        const seatDetails = details.map(item => item.idAsiento === metadata.idAsiento ? { ...item, estado: 'TEMPORAL', disponible: false, idReserva: reservation.idReserva } : item)
        return update({ selectedSeats: selected, passengers, reservations, reservationStatuses: [...current.reservationStatuses, { ...reservation, puedePagar: true }], selectedTrip: { ...current.selectedTrip, seatDetails }, message: '' })
      } catch (error) { return update({ message: error.message || 'El asiento acaba de ser tomado por otro usuario.' }) }
    }
    const selected = current.selectedSeats.filter(item => item !== seat)
    const reservations = current.reservations.filter(item => item.idAsiento !== metadata?.idAsiento)
    if (selected.length > 10) return
    const passengers = selected.map(token => {
      const item = details.find(detail => seatToken(detail) === token)
      return current.passengers.find(passenger => passenger.seatToken === token) || { seatToken: token, idAsiento: item?.idAsiento, piso: item?.piso, dni: '', nombres: '', apellidos: '' }
    })
    const seatDetails = details.map(item => item.idAsiento === metadata?.idAsiento ? { ...item, estado: 'DISPONIBLE', disponible: true, idReserva: null } : item)
    update({ selectedSeats: selected, passengers, reservations, reservationStatuses: current.reservationStatuses.filter(item => item.idReserva !== current.reservations.find(r => r.idAsiento === metadata?.idAsiento)?.idReserva), selectedTrip: { ...current.selectedTrip, seatDetails }, message: '' })
  }
  const updatePassenger = (index, patch) => update({ passengers: current.passengers.map((passenger, i) => i === index ? { ...passenger, ...patch } : passenger) })
  const lookupPassenger = async index => {
    const passenger = current.passengers[index]
    if (!/^\d{8}$/.test(passenger?.dni || '')) return
    try {
      const person = await lookupDni(passenger.dni)
      updatePassenger(index, { nombres: person.nombres || '', apellidos: [person.apellido_paterno, person.apellido_materno].filter(Boolean).join(' ') })
    } catch (error) { update({ message: error.message }) }
  }
  const continueToPassengers = () => {
    if (!current.selectedSeats.length) return update({ message: 'Selecciona al menos un asiento.' })
    update({ step: 3, message: '' })
  }
  const reserve = async () => {
    if (current.passengers.some(item => !item.dni || !item.nombres || !item.apellidos)) return update({ message: 'Completa los datos de todos los pasajeros.' })
    update({ busy: true, message: '' })
    try {
      await Promise.all(current.passengers.map(passenger => updateReservationPassenger(passenger.reservationId || current.reservations.find(r => r.idAsiento === passenger.idAsiento)?.idReserva, { dni: passenger.dni, nombres: passenger.nombres, apellidos: passenger.apellidos })))
      update({ step: 5, busy: false })
    } catch (error) { update({ busy: false, message: error.message || 'No se pudieron crear las reservas.' }) }
  }
  const pay = async () => {
    if (current.reservationStatuses.some(status => status.puedePagar === false || status.estado === 'VENCIDA')) return update({ message: 'La reserva ya venció y no puede pagarse.' })
    update({ busy: true, message: '' })
    try {
      const tickets = []
      for (const reservation of current.reservations) {
        const seatPrice = current.selectedTrip.seatDetails?.find(seat => seat.idAsiento === reservation.idAsiento)?.precio ?? current.selectedTrip.tarifaBase ?? current.selectedTrip.tarifa
        let payment
        try {
          payment = await createPayment({ idReserva: reservation.idReserva, importe: seatPrice, medioPago: 'PASARELA', tokenPasarela: 'mock_aprobado' })
        } catch (error) {
          const message = String(error.message || '').toLowerCase()
          if (!message.includes('pago aprobado') && !message.includes('ya tiene') && !message.includes('duplic')) throw error
          payment = await getApprovedPayment(reservation.idReserva)
        }
        tickets.push(await issueTicket({ idReserva: reservation.idReserva, idTransaccion: payment.idTransaccion }))
      }
      update({ tickets, step: 6, busy: false })
    } catch (error) { update({ busy: false, message: error.message || 'No se pudo completar el pago o emitir los pasajes.' }) }
  }
  const reset = () => setSale(null)
  const steps = ['Viaje', 'Asientos', 'Pasajeros', 'Reserva', 'Pago', 'Pasajes']
  const seats = current.selectedTrip?.seats || []
  const seatDetails = current.selectedTrip?.seatDetails || []
  const seatById = new Map(seatDetails.map(seat => [seat.idAsiento, seat]))
  const selectedSeatData = (current.selectedTrip?.seatDetails || []).filter(seat => current.selectedSeats.includes(seatToken(seat)))
  const totalAmount = selectedSeatData.reduce((sum, seat) => sum + Number(seat.precio ?? current.selectedTrip?.tarifaBase ?? current.selectedTrip?.tarifa ?? 0), 0)
  useEffect(() => {
    const tripId = current.selectedTrip?.idViaje
    if (current.step !== 2 || !tripId) return undefined
    const applyLock = (eventType, next, previousLock) => {
      const lock = eventType === 'DELETE' ? previousLock : next
      if (!lock) return
      // Supabase usa snake_case y el websocket camelCase.
      const seatId = lock.id_asiento ?? lock.idAsiento
      const reservationId = lock.id_reserva ?? lock.idReserva
      const lockState = lock.estado ?? lock.status
      if (seatId == null) return
      setSale(previous => {
        if (!previous?.selectedTrip || previous.selectedTrip.idViaje !== tripId) return previous
        const released = eventType === 'DELETE' || !['TEMPORAL', 'CONFIRMADA'].includes(lockState)
        const seatDetails = (previous.selectedTrip.seatDetails || []).map(seat => Number(seat.idAsiento) === Number(seatId)
          ? { ...seat, estado: released ? 'DISPONIBLE' : lockState, disponible: released, idReserva: released ? null : reservationId }
          : seat)
        const own = previous.reservations.some(reservation => Number(reservation.idReserva) === Number(reservationId))
        return { ...previous, selectedTrip: { ...previous.selectedTrip, seatDetails }, message: !released && !own ? `El asiento ${seatId} fue reservado por otra ventanilla.` : previous.message }
      })
    }
    const removeSupabase = subscribeSeatLocks(tripId, ({ eventType, new: next, old: previousLock }) => applyLock(eventType, next, previousLock))

    // Compatibilidad con despliegues que todavía escriben en SQLite/PostgreSQL local.
    // Cuando DATABASE_URL apunta a Supabase, el trigger de seat_locks será el canal principal.
    const token = localStorage.getItem('cruz_token')
    const base = API_BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')
    let socket
    let retryTimer
    let stopped = false
    let retryCount = 0
    const connect = () => {
      if (stopped || !token) return
      socket = new WebSocket(`${base}/api/v1/reservas/ws/${tripId}?access_token=${encodeURIComponent(token)}`)
      socket.onmessage = event => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'snapshot') {
            setSale(previous => {
              if (!previous?.selectedTrip || previous.selectedTrip.idViaje !== tripId) return previous
              const live = new Map((payload.asientos || []).map(seat => [Number(seat.idAsiento), seat]))
              const seatDetails = (previous.selectedTrip.seatDetails || []).map(seat => {
                const update = live.get(Number(seat.idAsiento))
                return update ? { ...seat, ...update, precio: seat.precio } : seat
              })
              return { ...previous, selectedTrip: { ...previous.selectedTrip, seatDetails } }
            })
          } else if (payload.type === 'seat_held') {
            applyLock('INSERT', { idAsiento: payload.idAsiento, idReserva: payload.idReserva, estado: payload.estado }, null)
          } else if (payload.type === 'seat_released') {
            applyLock('DELETE', null, { idAsiento: payload.idAsiento, idReserva: payload.idReserva, estado: payload.estado })
          }
        } catch { /* se conserva el último estado válido */ }
      }
      socket.onopen = () => { retryCount = 0 }
      socket.onclose = () => {
        if (stopped) return
        retryTimer = setTimeout(connect, Math.min(1000 * (2 ** retryCount++), 10000))
      }
      socket.onerror = () => socket.close()
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      removeSupabase()
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close()
    }
  }, [current.step, current.selectedTrip?.idViaje, setSale])
  useEffect(() => {
    if (current.step !== 5 || !current.reservations.length) return undefined
    let mounted = true
    const refreshStatus = async () => {
      try {
        const statuses = await Promise.all(current.reservations.map(reservation => getReservationStatus(reservation.idReserva)))
        if (mounted) setSale(previous => ({ ...previous, reservationStatuses: statuses }))
      } catch {
        // Se conserva el último estado conocido si una consulta intermedia falla.
      }
    }
    refreshStatus()
    const timer = setInterval(refreshStatus, 15000)
    return () => { mounted = false; clearInterval(timer) }
  }, [current.step, current.reservations, setSale])
  useEffect(() => {
    if (current.step !== 5) return undefined
    const statusText = document.querySelector('.payment-card p')
    if (!statusText) return undefined
    const remaining = current.reservationStatuses.length ? Math.max(0, Math.min(...current.reservationStatuses.map(status => Number(status.minutosRestantes || 0)))) : 0
    const expired = current.reservationStatuses.some(status => status.puedePagar === false || status.estado === 'VENCIDA')
    statusText.textContent = expired ? 'La reserva venció. Ya no se puede pagar.' : `Reserva temporal · ${remaining.toFixed(1)} minutos restantes`
    statusText.classList.toggle('expired', expired)
    return undefined
  }, [current.step, current.reservationStatuses])
  useEffect(() => {
    if (current.step !== 2 || !current.selectedTrip) return undefined
    const details = current.selectedTrip.seatDetails || []
    const buttons = [...document.querySelectorAll('.seat-grid .seat')]
    buttons.forEach((button, index) => {
      const seat = details[index]
      const selected = seat ? current.selectedSeats.includes(seatToken(seat)) : false
      const own = seat?.idReserva != null && current.reservations.some(reservation => Number(reservation.idReserva) === Number(seat.idReserva))
      const heldByOther = seat?.estado && ['TEMPORAL', 'CONFIRMADA'].includes(seat.estado) && !selected && !own
      const sold = seat?.estado && seat.estado !== 'DISPONIBLE' && !selected && !heldByOther
      button.classList.toggle('sold', Boolean(sold))
      button.classList.toggle('held-by-other', Boolean(heldByOther))
      if (seat) button.textContent = String(seat.numero ?? seat.idAsiento)
      const columns = Number(seat?.columnas || 4)
      const fallbackIndex = details.findIndex(item => item.idAsiento === seat?.idAsiento)
      // En el bus horizontal, la fila avanza hacia el fondo y la columna
      // representa la posición transversal del asiento.
      button.style.gridColumn = String(Number(seat?.fila || (Math.floor(fallbackIndex / columns) + 1)))
      button.style.gridRow = String(Number(seat?.columnaNumero || ((fallbackIndex % columns) + 1)))
      button.title = seat ? `${seat.tipo || 'Asiento'} · Piso ${seat.piso || '—'} · ${seat.columna || '—'} · S/ ${seat.precio ?? '—'}` : ''
    })
    return undefined
  }, [current.step, current.selectedTrip, current.selectedSeats, current.reservations])
  useEffect(() => {
    if (current.step !== 6 || !current.tickets?.length) return undefined
    const box = document.querySelector('.sales-desk .ticket-code')
    if (!box) return undefined
    const links = current.tickets.map(ticket => {
      const link = document.createElement('a')
      link.className = 'primary-button ticket-link'
      link.href = ticket.documentoUrl || `${import.meta.env.VITE_API_BASE_URL || 'https://cruzdelnorte.duckdns.org'}/documentos/${ticket.codigo}.pdf`
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.textContent = 'Ver pasaje'
      return link
    })
    links.forEach(link => box.appendChild(link))
    return () => links.forEach(link => link.remove())
  }, [current.step, current.tickets])
  useEffect(() => {
    if (current.step !== 2 || current.selectedTrip) return undefined
    document.querySelectorAll('.trip-option').forEach((option, index) => {
      const label = option.querySelector('strong')
      const trip = current.trips[index]
      if (label) label.textContent = trip?.nombreBus || trip?.bus || trip?.empresa || 'Servicio de bus'
    })
    return undefined
  }, [current.step, current.selectedTrip, current.trips])
  useEffect(() => {
    if (current.step !== 2 || !current.selectedTrip) return undefined
    const details = current.selectedTrip.seatDetails || []
    const description = document.querySelector('.sale-main .form-title p')
    if (description) description.textContent = `${current.origen} → ${current.destino} · ${current.fecha} · ${current.selectedTrip.tipoBus || 'Bus'} · ${current.selectedTrip.pisos || 1} piso(s) · ${current.selectedTrip.capacidad || details.length} asientos`
    const grid = document.querySelector('.seat-grid')
    if (grid) {
      grid.dataset.layout = current.selectedTrip.tipoBus || ''
      details.forEach((seat, index) => {
        const button = grid.querySelectorAll('.seat')[index]
        if (button) button.title = `Piso ${seat.piso ?? '—'} · ${seat.columna || '—'} · ${seat.estado || '—'} · S/ ${seat.precio ?? '—'}`
      })
    }
    return undefined
  }, [current.step, current.selectedTrip, current.origen, current.destino, current.fecha])
  useEffect(() => {
    if (current.step !== 2 || !current.selectedTrip) return undefined
    const grid = document.querySelector('.seat-grid')
    if (!grid) return undefined
    const details = current.selectedTrip.seatDetails || []
    const floors = [...new Set(details.map(seat => Number(seat.piso || 1)))].sort((a, b) => a - b)
    const tabs = document.createElement('div')
    tabs.className = 'floor-tabs'
    const legend = document.createElement('div')
    legend.className = 'seat-legend'
    legend.innerHTML = '<span><i class="legend-dot available"></i>Disponible</span><span><i class="legend-dot selected"></i>Seleccionado</span><span><i class="legend-dot held-by-other"></i>Ocupado en otra ventanilla</span><span><i class="legend-dot sold"></i>Vendido</span>'
    const buttons = [...grid.querySelectorAll('.seat')]
    const showFloor = floor => {
      const floorSeats = details.filter(item => Number(item.piso || 1) === floor)
      const columns = Number(floorSeats.reduce((max, item) => Math.max(max, Number(item.fila || 1)), 0) || current.selectedTrip?.columnasPorPiso?.[floor] || 4)
      grid.style.setProperty('--seat-columns', String(columns))
      const stairOpeningOnly = current.selectedTrip?.tipoBus === 'DOS_PISOS_48' && floor === 2
      const hasStair = stairOpeningOnly && columns > 2
      const hasAisle = columns > 2 && floor !== 1 && !stairOpeningOnly
      const floorOneRowAisle = floor === 1
      const stairAfter = 2
      grid.classList.toggle('has-stair', hasStair)
      grid.style.gridTemplateColumns = hasAisle
        ? `repeat(${stairAfter}, minmax(34px, 1fr)) ${hasStair ? 'minmax(150px, 4fr)' : '58px'} repeat(${Math.max(0, columns - stairAfter)}, minmax(34px, 1fr))`
        : `repeat(${columns}, minmax(34px, 1fr))`
      grid.style.gridTemplateRows = floorOneRowAisle ? 'minmax(34px, 1fr) 28px repeat(2, minmax(34px, 1fr))' : ''
      buttons.forEach((button, index) => {
        const seat = details[index]
        const seatRow = Number(seat?.fila || 0)
        const seatColumn = Number(seat?.columnaNumero || 0)
        const stairOpening = floor === 2 && [3, 4].includes(seatRow) && [1, 2].includes(seatColumn)
        button.hidden = Number(seat?.piso || 1) !== floor || stairOpening
        const horizontalPosition = Number(seat?.fila || 1)
        button.style.gridColumn = String(hasAisle && horizontalPosition > stairAfter ? horizontalPosition + 1 : horizontalPosition)
        button.style.gridRow = floorOneRowAisle && seatColumn > 1 ? String(seatColumn + 1) : String(seatColumn || 1)
      })
      tabs.querySelectorAll('button').forEach(button => button.classList.toggle('active', Number(button.dataset.floor) === floor))
    }
    floors.forEach(floor => {
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.dataset.floor = String(floor)
      tab.textContent = `Piso #${floor}`
      tab.onclick = () => showFloor(floor)
      tabs.appendChild(tab)
    })
    grid.parentNode.insertBefore(legend, grid)
    if (floors.length > 1) grid.parentNode.insertBefore(tabs, legend)
    showFloor(floors[0] || 1)
    return () => { tabs.remove(); legend.remove(); buttons.forEach(button => { button.hidden = false }) }
  }, [current.step, current.selectedTrip])
  return <section className="sales-desk"><div className="sales-head"><div><p className="eyebrow">MÓDULO DE VENTANILLA</p><h1>Vender pasajes</h1><p className="subtext">Selecciona asientos y registra uno o varios pasajeros.</p></div><div className="counter-chip"><span className="pulse"></span> Caja 04 · En línea</div></div><div className="stepper">{steps.map((label, i) => <div className={`step ${current.step > i + 1 ? 'done' : ''} ${current.step === i + 1 ? 'current' : ''}`} key={label}><span>{current.step > i + 1 ? '✓' : i + 1}</span><small>{label}</small></div>)}</div><div className="sale-layout"><div className="panel sale-main">{current.step === 1 && <form className="sale-form" onSubmit={searchTrips}><FormTitle title="¿A dónde viaja el cliente?" desc="Busca salidas y disponibilidad en tiempo real." /><div className="form-grid"><label>Origen<select value={current.origen} onChange={e => update({ origen: e.target.value })}><option>Lima</option><option>Ica</option><option>Trujillo</option><option>Arequipa</option></select></label><label>Destino<select value={current.destino} onChange={e => update({ destino: e.target.value })}><option>Ica</option><option>Lima</option><option>Trujillo</option><option>Arequipa</option></select></label><label>Fecha de viaje<input type="date" value={current.fecha} onChange={e => update({ fecha: e.target.value })} /></label></div><div className="sale-actions"><button className="primary-button" disabled={current.busy}>{current.busy ? 'Consultando…' : 'Buscar salidas'}</button></div>{current.message && <div className="sale-note error">{current.message}</div>}</form>}{current.step === 2 && <div className="sale-form"><FormTitle title="Elige una salida y sus asientos" desc={`${current.origen} → ${current.destino} · ${current.fecha}`} />{!current.selectedTrip ? <div className="trip-options">{current.trips.map((trip, i) => <button type="button" className="trip-option" key={trip.idViaje || i} onClick={() => chooseTrip(trip)}><span className="trip-time">{trip.horaSalida || trip.hora || '—'}</span><span><strong>Bus Cruz del Norte</strong><small>{(trip.asientosDisponibles || []).length} asientos disponibles</small></span><b>S/ {trip.tarifa}</b><ArrowUpRight size={15} /></button>)}</div> : <><div className="seat-grid">{seats.map(seat => <button type="button" className={`seat ${current.selectedSeats.includes(seat) ? 'selected' : ''}`} key={seat} onClick={() => toggleSeat(seat)}> {seat}</button>)}</div><p className="subtext">Seleccionados: {current.selectedSeats.length}/10</p><div className="sale-actions"><button className="secondary-button" onClick={() => update({ selectedTrip: null, selectedSeats: [] })}>Cambiar salida</button><button className="primary-button" onClick={continueToPassengers}>Continuar</button></div></>}{current.message && <div className="sale-note error">{current.message}</div>}</div>}{current.step === 3 && <div className="sale-form"><FormTitle title="Datos de los pasajeros" desc="Cada asiento debe tener un pasajero validado." />{current.passengers.map((passenger, index) => <div className="passenger-card" key={passenger.idAsiento}><strong>Asiento {passenger.idAsiento}</strong><div className="form-grid"><label>DNI<input required value={passenger.dni} onChange={e => updatePassenger(index, { dni: e.target.value })} onBlur={() => lookupPassenger(index)} placeholder="74859621" /></label><label>Nombres<input required value={passenger.nombres} onChange={e => updatePassenger(index, { nombres: e.target.value })} /></label><label>Apellidos<input required value={passenger.apellidos} onChange={e => updatePassenger(index, { apellidos: e.target.value })} /></label></div></div>)}<div className="sale-actions"><button className="secondary-button" onClick={() => update({ step: 2 })}>Atrás</button><button className="primary-button" onClick={() => update({ step: 4 })}>Revisar reserva</button></div>{current.message && <div className="sale-note error">{current.message}</div>}</div>}{current.step === 4 && <div className="sale-form"><FormTitle title="Revisa la reserva" desc={`${current.passengers.length} pasaje(s) · S/ ${(current.passengers.length * (current.selectedTrip?.tarifa || 0)).toFixed(2)}`} />{current.passengers.map(item => <div className="reservation-review" key={item.idAsiento}><div><small>Pasajero</small><strong>{item.nombres} {item.apellidos}</strong><span>DNI {item.dni}</span></div><div><small>Asiento</small><strong>{item.idAsiento}</strong><span>{current.origen} → {current.destino}</span></div></div>)}<div className="sale-actions"><button className="secondary-button" onClick={() => update({ step: 3 })}>Atrás</button><button className="primary-button" onClick={reserve} disabled={current.busy}>{current.busy ? 'Reservando…' : 'Crear reserva'}</button></div>{current.message && <div className="sale-note error">{current.message}</div>}</div>}{current.step === 5 && <div className="sale-form"><FormTitle title="Cobrar y emitir" desc={`${current.reservations.length} pasaje(s) · S/ ${(current.reservations.length * (current.selectedTrip?.tarifa || 0)).toFixed(2)}`} /><div className="payment-card"><div className="payment-label"><CreditCard size={19} /><span>Pago con pasarela</span><strong>S/ {(current.reservations.length * (current.selectedTrip?.tarifa || 0)).toFixed(2)}</strong></div></div><div className="sale-actions"><button className="secondary-button" onClick={() => update({ step: 4 })}>Atrás</button><button className="primary-button" onClick={pay} disabled={current.busy}>{current.busy ? 'Procesando…' : 'Cobrar y emitir'}</button></div>{current.message && <div className="sale-note error">{current.message}</div>}</div>}{current.step === 6 && <div className="sale-form success-screen"><div className="success-mark"><ShieldCheck size={28} /></div><FormTitle title="Pasajes emitidos" desc={`${current.tickets.length} pasaje(s) emitido(s) correctamente.`} /><div className="ticket-code">{current.tickets.map(ticket => <strong key={ticket.codigo}>{ticket.codigo}</strong>)}</div><div className="sale-actions"><button className="primary-button" onClick={reset}>Nueva venta</button></div></div>}</div><aside className="panel sale-sidebar"><h2>Seguimiento de la venta</h2><p>Hasta 10 pasajeros por compra.</p><StatusLine number="01" title="Datos del viaje" active={current.step >= 1} done={current.step > 1} /><StatusLine number="02" title="Asientos" active={current.step >= 2} done={current.step > 2} /><StatusLine number="03" title="Pasajeros" active={current.step >= 3} done={current.step > 3} /><StatusLine number="04" title="Reserva" active={current.step >= 4} done={current.step > 4} /><StatusLine number="05" title="Pago" active={current.step >= 5} done={current.step > 5} /><StatusLine number="06" title="Pasajes emitidos" active={current.step >= 6} done={current.step >= 6} /></aside></div></section>
}

function FormTitle({ title, desc }) { return <div className="form-title"><h2>{title}</h2><p>{desc}</p></div> }
function StatusLine({ number, title, active, done }) { return <div className={`status-line ${active ? 'active' : ''} ${done ? 'done' : ''}`}><span>{done ? '✓' : number}</span><strong>{title}</strong></div> }

function Metric({ icon: Icon, label, value, delta, note, color, down }) { return <div className="metric-card"><div className={`metric-icon ${color}`}><Icon size={19} /></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small className={down ? 'neutral' : ''}><em>{down ? '−' : '↑'} {delta}</em> {note}</small></div></div> }
function ActivityItem({ icon: Icon, title, desc, time, tone }) { return <div className="activity-item"><span className={`activity-icon ${tone}`}><Icon size={16} /></span><div><strong>{title}</strong><p>{desc}</p></div><time>{time}</time></div> }
function ApiModal({ onClose, onConnect, contractStatus }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><p className="eyebrow">CONTRATO DE INTEGRACIÓN</p><h2>Mapa de endpoints</h2><p>7 dominios · colección SC-01 a SC-06</p></div><button className="close-button" onClick={onClose}><X size={19} /></button></div><div className="endpoint-list">{apiGroups.map(g => { const live = contractStatus.find(x => x.label === g.name); return <div className="endpoint-group" key={g.name}><div className="endpoint-title"><span className={`service-icon ${g.tone}`}><Activity size={14} /></span><strong>{g.name}</strong><span className={live?.online ? 'live-dot' : ''}>{live ? (live.online ? 'online' : 'sin respuesta') : `${g.count} ${g.count === 1 ? 'ruta' : 'rutas'}`}</span></div>{g.endpoints.map(e => <code key={e}>{e}</code>)}</div> })}</div><div className="missing-box"><FileText size={17} /><div><strong>Recomendados para completar la API</strong><p>GET detalle de reserva · GET estado de pago · POST cancelación de pasaje · GET catálogo de rutas · GET disponibilidad de flota.</p></div></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cerrar</button><button className="primary-button" onClick={onConnect}><ShieldCheck size={16} /> Autenticar contra gateway</button></div></div></div> }

createRoot(document.getElementById('root')).render(<App />)
