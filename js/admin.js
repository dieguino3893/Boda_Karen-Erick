// ─── CONFIG ───────────────────────────────────────────────
const ruta = "https://vellum-services.runasp.net/asistencia";
let listaInvitados = [];
let toastInstance;
let html5QrCode;
let qrInitialized = false;
let escaneoEnProceso = false;
let syncEnProceso = false;

// ─── CACHE / COLA OFFLINE ─────────────────────────────────
const CACHE_KEY = 'qr_cache_pendiente';
const REJECTED_KEY = 'qr_cache_rechazados';

function getCachePendiente() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); }
    catch { return []; }
}

function saveCachePendiente(arr) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(arr));
    actualizarBadgesPendientes();
}

function getRechazosSync() {
    try { return JSON.parse(localStorage.getItem(REJECTED_KEY) || '[]'); }
    catch { return []; }
}

function saveRechazosSync(arr) {
    localStorage.setItem(REJECTED_KEY, JSON.stringify(arr));
}

function actualizarBadgesPendientes() {
    const pending = getCachePendiente();

    const badge = document.getElementById('cache-badge');
    const count = document.getElementById('cache-count');
    if (badge) {
        if (pending.length > 0) {
            badge.classList.add('show');
            if (count) count.textContent = pending.length;
        } else {
            badge.classList.remove('show');
        }
    }

    const syncBadge = document.getElementById('sync-badge');
    if (syncBadge) syncBadge.textContent = pending.length;

    const syncBtn = document.getElementById('btn-sync-queue');
    if (syncBtn) {
        syncBtn.classList.toggle('pulse', pending.length > 0);
        syncBtn.classList.toggle('btn-warning', pending.length > 0);
        syncBtn.classList.toggle('btn-outline-warning', pending.length === 0);
    }
}

function agregarAlCache(uuid, cantidad, meta = {}) {
    const pending = getCachePendiente();
    pending.push({ uuid, cantidad, timestamp: Date.now(), ...meta });
    saveCachePendiente(pending);
}

function aplicarEntradaLocal(uuid, cantidad) {
    const inv = listaInvitados.find(i => i.uuid === uuid);
    if (!inv) return false;

    const cupoMaximo = (Number(inv.usos_restantes) || 0);
    const actuales = Number(inv.usos_restantes);
    const restantes = Number.isFinite(actuales) ? actuales : cupoMaximo;

    inv.asistencia = true;
    inv.usos_restantes = Math.max(0, restantes - cantidad);

    actualizarStats();
    renderMesas();
    aplicarFiltros();
    return true;
}

async function sincronizarCola({ silencioso = false } = {}) {
    if (syncEnProceso) return;
    if (!navigator.onLine) {
        if (!silencioso) showToast('Sin conexión — la cola sigue pendiente');
        return;
    }

    const pending = getCachePendiente();
    if (pending.length === 0) {
        if (!silencioso) showToast('No hay solicitudes pendientes');
        actualizarBadgesPendientes();
        return;
    }

    syncEnProceso = true;
    const pendientes = [];
    const rechazadas = [];
    let exitosas = 0;

    for (const item of pending) {
        try {
            const res = await fetch(
                `${ruta}/qr?uuid=${encodeURIComponent(item.uuid)}&cantidad=${item.cantidad}`,
                { method: 'POST' }
            );

            let data = null;
            try { data = await res.json(); } catch { /* sin JSON */ }

            if (!res.ok) {
                rechazadas.push({
                    ...item,
                    motivo: data?.message || data?.msg || data?.error || `HTTP ${res.status}`
                });
                continue;
            }

            exitosas++;
        } catch (error) {
            pendientes.push(item);
        }
    }

    saveCachePendiente(pendientes);

    if (rechazadas.length > 0) {
        const prev = getRechazosSync();
        saveRechazosSync([...prev, ...rechazadas]);
    }

    if (exitosas > 0) {
        showToast(`✓ ${exitosas} solicitud${exitosas !== 1 ? 'es' : ''} sincronizada${exitosas !== 1 ? 's' : ''}`);
        cargarInvitados();
    }

    if (rechazadas.length > 0) {
        const detalle = rechazadas
            .map(r => `${r.nombre || r.uuid} — ${r.motivo}`)
            .join('<br>');
        Swal.fire({
            icon: 'warning',
            title: 'Algunas entradas fueron rechazadas',
            html: detalle,
            confirmButtonColor: '#c9a84c',
            confirmButtonText: 'OK'
        });
    }

    syncEnProceso = false;
    actualizarBadgesPendientes();
}

// ─── ONLINE / OFFLINE ─────────────────────────────────────
function actualizarEstadoConexion() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    document.body.classList.toggle('offline-visible', !navigator.onLine);

    if (navigator.onLine) {
        banner.classList.remove('show');
        actualizarBadgesPendientes();
        sincronizarCola({ silencioso: true });
    } else {
        banner.classList.add('show');
        actualizarBadgesPendientes();
    }
}

window.addEventListener('online', actualizarEstadoConexion);
window.addEventListener('offline', actualizarEstadoConexion);

// ─── TOAST ─────────────────────────────────────────────────
/**
 * Muestra un toast con soporte de tipos: 'default' | 'success' | 'warning' | 'error' | 'offline'
 * @param {string} msg
 * @param {'default'|'success'|'warning'|'error'|'offline'} [tipo='default']
 * @param {number} [delay=2500]
 */
function showToast(msg, tipo = 'default', delay = 2500) {
    const toastEl = document.getElementById('alert-toast');
    if (!toastEl) return;

    // Limpiar clases de tipo previas
    toastEl.classList.remove('toast-success', 'toast-warning', 'toast-error', 'toast-offline');
    if (tipo !== 'default') toastEl.classList.add(`toast-${tipo}`);

    toastInstance = new bootstrap.Toast(toastEl, { delay });
    const body = document.getElementById('toast-body');
    if (body) body.innerHTML = msg; // innerHTML para permitir iconos HTML
    toastInstance.show();
}

// ─── VALIDACIÓN ESTRICTA DE UUID ──────────────────────────
/**
 * Busca el invitado en listaInvitados y valida que tenga usos_restantes > 0.
 * Retorna { valido: true, invitado } si pasa, o { valido: false, motivo } si no.
 */
function validarUUID(uuid) {
    if (!uuid) return { valido: false, motivo: 'UUID vacío' };

    const invitado = listaInvitados.find(i => i.uuid === uuid);

    if (!invitado) {
        return {
            valido: false,
            motivo: '¡QR Inválido! El invitado no pertenece a este evento'
        };
    }

    const usosRestantes = Number(invitado.usos_restantes);
    if (Number.isFinite(usosRestantes) && usosRestantes <= 0) {
        return {
            valido: false,
            motivo: `Este QR ya no tiene accesos disponibles (${invitado.nombre})`
        };
    }

    return { valido: true, invitado };
}

/**
 * Muestra el SweetAlert de error para QR inválido y vuelve a activar el escáner.
 */
function mostrarErrorQR(motivo) {
    Swal.fire({
        icon: 'error',
        title: 'Acceso Denegado',
        text: motivo,
        confirmButtonColor: '#c9a84c',
        confirmButtonText: 'Entendido'
    });
}


function normalizarInvitado(raw) {
    return {
        id: raw.id ?? raw.Id ?? raw._id?.$oid ?? null,
        nombre: raw.nombre ?? raw.Nombre ?? '',
        asistencia: raw.asistencia ?? raw.Asistencia ?? null,
        invitados: raw.invitados ?? raw.Invitados ?? 0,
        mesa: raw.mesa ?? raw.Mesa ?? null,
        uuid: raw.uuid ?? raw.Uuid ?? null,
        usos_restantes: raw.usos_restantes ?? raw.UsosRestantes ?? raw.usosRestantes ?? null,
        fecha_registro: raw.fecha_registro ?? raw.FechaRegistro ?? null,
    };
}

// ─── CARGAR ────────────────────────────────────────────────
async function cargarInvitados() {
    try {
        const res = await fetch(ruta);
        const raw = await res.json();
        listaInvitados = raw.map(normalizarInvitado);
        aplicarFiltros();
        actualizarStats();
        renderMesas();
        actualizarBadgesPendientes();
    } catch (e) {
        console.error('Error cargando invitados:', e);
    }
}

// ─── STATS GLOBALES ────────────────────────────────────────
function actualizarStats() {
    const total = listaInvitados.length;
    const confirmados = listaInvitados.filter(i => i.asistencia === true).length;
    const pendientes = listaInvitados.filter(i => i.asistencia === null).length;
    const rechazados = listaInvitados.filter(i => i.asistencia === false).length;
    const enFiesta = calcularEnFiesta();
    const mesasActivas = new Set(listaInvitados.filter(i => i.mesa).map(i => i.mesa)).size;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('stat-total', total);
    setText('stat-confirmados', confirmados);
    setText('stat-pendientes', pendientes);
    setText('stat-rechazados', rechazados);
    setText('stat-fiesta', enFiesta);
    setText('stat-mesas', mesasActivas);

    setText('fiesta-total', enFiesta);
    setText('chip-confirmados', confirmados);
    const totalAcomp = listaInvitados.reduce((a, i) => a + (Number(i.invitados) || 0), 0);
    setText('chip-acompanantes', totalAcomp);
}

// ─── CALCULAR EN FIESTA ────────────────────────────────────
function calcularEnFiesta() {
    return listaInvitados.reduce((total, inv) => {
        if (inv.asistencia !== true) return total;
        const cupoMaximo = (Number(inv.invitados) || 0) + 1;
        const restantes = inv.usos_restantes ?? cupoMaximo;
        return total + Math.max(0, cupoMaximo - restantes);
    }, 0);
}

// ─── RENDER TABLA INVITADOS ────────────────────────────────
function renderizarTabla(datos) {
    const tbody = document.getElementById('invitados-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const contador = document.getElementById('contador-lista');
    if (contador) contador.textContent = `${datos.length} registro${datos.length !== 1 ? 's' : ''}`;

    datos.forEach((inv, index) => {
        const asistBadge = inv.asistencia === null
            ? '<span class="badge-pendiente">Pendiente</span>'
            : inv.asistencia
                ? '<span class="badge-confirmado">Confirmado</span>'
                : '<span class="badge-rechazado">No asiste</span>';

        const usosRestantes = Number(inv.usos_restantes);
        const sinCupo = Number.isFinite(usosRestantes) && usosRestantes <= 0;
        const btnEntradaLabel = sinCupo ? '🚫 Sin cupo' : '🚪 Registrar';
        const btnEntradaDisabled = sinCupo ? 'disabled title="Este invitado ya no tiene cupos disponibles"' : '';
        const btnEntradaClass = sinCupo ? 'btn btn-outline-muted' : 'btn btn-entrada';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--muted);font-size:.78rem">${index + 1}</td>
            <td><input type="text" id="nombre-${inv.id}" class="form-control form-control-sm" value="${inv.nombre}" placeholder="Nombre"></td>
            <td>${asistBadge}</td>
            <td><input type="number" id="acompanantes-${inv.id}" class="form-control form-control-sm" value="${inv.invitados}" placeholder="0" style="width:70px"></td>
            <td><input type="number" id="mesa-${inv.id}" class="form-control form-control-sm" value="${inv.mesa || ''}" placeholder="—" style="width:70px"></td>
            <td>
                <div class="d-flex gap-1 flex-wrap">
                    <button class="${btnEntradaClass}" onclick="registrarEntradaManualPorId('${inv.uuid}')" ${btnEntradaDisabled}>${btnEntradaLabel}</button>
                    <button class="btn btn-outline-gold" onclick="Actualizar('${inv.id}')">Guardar</button>
                    <button class="btn btn-outline-muted" onclick="copiarEnlace('${inv.uuid}')">Copiar</button>
                    <button class="btn btn-outline-danger-soft" onclick="eliminarInvitado('${inv.id}')">Eliminar</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

function aplicarFiltros() {
    const qEl = document.getElementById('search-name');
    const asistEl = document.getElementById('filter-asistencia');
    const mesaEl = document.getElementById('filter-mesa');
    if (!qEl || !asistEl || !mesaEl) return;

    const q = qEl.value.toLowerCase();
    const asist = asistEl.value;
    const mesa = mesaEl.value.toLowerCase();

    const filtrados = listaInvitados.filter(inv => {
        const nombre = (inv.nombre || '').toLowerCase().includes(q);
        const mesaOk = (inv.mesa || '').toString().toLowerCase().includes(mesa);
        let asistOk = true;
        if (asist === 'confirmados') asistOk = inv.asistencia === true;
        if (asist === 'pendientes') asistOk = inv.asistencia === null;
        if (asist === 'rechazados') asistOk = inv.asistencia === false;
        return nombre && mesaOk && asistOk;
    });

    renderizarTabla(filtrados);
}

// ─── ACTUALIZAR ────────────────────────────────────────────
async function Actualizar(id) {
    const nombre = document.getElementById(`nombre-${id}`)?.value?.trim();
    const acomp = document.getElementById(`acompanantes-${id}`)?.value;
    const mesa = document.getElementById(`mesa-${id}`)?.value;
    if (!nombre) return;

    await fetch(ruta + `/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Nombre: nombre, Mesa: Number(mesa) || null, Invitados: Number(acomp) })
    });
    showToast(`✓ "${nombre}" actualizado — Mesa ${mesa || 'sin asignar'}`);
    cargarInvitados();
}

async function eliminarInvitado(id) {
    if (!confirm('¿Seguro que deseas eliminar este invitado?')) return;
    await fetch(ruta + `/${id}`, { method: 'DELETE' });
    cargarInvitados();
}

function copiarEnlace(uuid) {
    if (!uuid) return alert('UUID no disponible');
    const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
    const link = `${origin}/?datos=${encodeURIComponent(uuid)}`;
    navigator.clipboard.writeText(link)
        .then(() => showToast('✓ Enlace copiado'))
        .catch(() => alert('No se pudo copiar.'));
}

async function agregarInvitado() {
    const nombre = document.getElementById('nuevo-nombre')?.value.trim();
    const acomp = Number(document.getElementById('nuevo-invitados')?.value || 0);
    const mesa = Number(document.getElementById('nuevo-mesa')?.value || 0);
    if (!nombre) return alert('Nombre es requerido');

    const payload = { nombre, invitados: acomp, ...(mesa ? { mesa } : {}) };
    const res = await fetch(ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) return alert('Error al crear invitado');

    showToast(`✓ Invitado agregado: ${nombre}`);
    document.getElementById('add-invitado-form')?.reset();
    cargarInvitados();
}

// ─── PANEL DE MESAS ────────────────────────────────────────
function renderMesas() {
    const porMesa = {};

    listaInvitados.forEach(inv => {
        const m = inv.mesa;
        if (!m) return;
        if (!porMesa[m]) porMesa[m] = { capacidad: 0, presentes: 0, grupos: 0 };

        const cupoGrupo = (Number(inv.invitados) || 0) + 1;
        const restantes = inv.usos_restantes ?? cupoGrupo;
        const hanEntrado = Math.max(0, cupoGrupo - restantes);

        if (inv.asistencia === true) porMesa[m].capacidad += cupoGrupo;
        porMesa[m].presentes += hanEntrado;
        porMesa[m].grupos += 1;
    });

    const mesasOrdenadas = Object.keys(porMesa).map(Number).sort((a, b) => a - b);
    const grid = document.getElementById('mesas-grid');
    if (!grid) return;
    grid.innerHTML = '';
    let mesasCompletas = 0;

    mesasOrdenadas.forEach(m => {
        const s = porMesa[m];
        const pct = s.capacidad > 0 ? Math.min(s.presentes / s.capacidad, 1) : 0;
        const llena = s.capacidad > 0 && s.presentes >= s.capacidad;
        const vacia = s.presentes === 0;
        if (llena) mesasCompletas++;

        const barColor = llena ? '#e07070' : vacia ? '#7ecb9a' : '#c9a84c';
        const card = document.createElement('div');
        card.className = `mesa-card${llena ? ' llena' : ''}`;
        card.onclick = () => mostrarDetalleMesa(m);
        card.innerHTML = `
            <div class="mesa-numero">${m}</div>
            <div class="mesa-label">Mesa</div>
            <div class="mesa-barra-wrap">
                <div class="mesa-barra" style="width:${pct * 100}%;background:${barColor}"></div>
            </div>
            <div class="mesa-info">
                <span style="color:var(--muted)">Presentes</span>
                <span>${s.presentes} / ${s.capacidad}</span>
            </div>
            <div class="mesa-info mt-1">
                <span style="color:var(--muted)">Grupos</span>
                <span>${s.grupos}</span>
            </div>`;
        grid.appendChild(card);
    });

    const chipMesas = document.getElementById('chip-mesas-llenas');
    if (chipMesas) chipMesas.textContent = mesasCompletas;
}

// ─── DETALLE DE MESA ───────────────────────────────────────
function mostrarDetalleMesa(numMesa) {
    const invitadosMesa = listaInvitados.filter(i => i.mesa == numMesa);
    const titulo = document.getElementById('mesa-detalle-titulo');
    if (titulo) {
        titulo.textContent = `Mesa ${numMesa} — ${invitadosMesa.length} grupo${invitadosMesa.length !== 1 ? 's' : ''}`;
    }

    const tbody = document.getElementById('mesa-detalle-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const thead = document.querySelector('#mesa-detalle table thead tr');
    if (thead && thead.children.length === 3) {
        const th = document.createElement('th');
        th.textContent = 'Entradas';
        thead.appendChild(th);
    }

    if (invitadosMesa.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);text-align:center">Sin invitados asignados</td></tr>`;
    } else {
        invitadosMesa.forEach(inv => {
            const cupoGrupo = (Number(inv.invitados) || 0) + 1;
            const restantes = inv.usos_restantes ?? cupoGrupo;
            const hanEntrado = Math.max(0, cupoGrupo - restantes);

            const asistBadge = inv.asistencia === null
                ? '<span class="badge-pendiente">Pendiente</span>'
                : inv.asistencia
                    ? '<span class="badge-confirmado">Confirmado</span>'
                    : '<span class="badge-rechazado">No asiste</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${inv.nombre}</td>
                <td>${asistBadge}</td>
                <td>${inv.invitados} acompañante${inv.invitados !== 1 ? 's' : ''}</td>
                <td>${hanEntrado} / ${cupoGrupo}</td>`;
            tbody.appendChild(tr);
        });
    }

    const det = document.getElementById('mesa-detalle');
    if (det) {
        det.style.display = '';
        det.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function cerrarDetalleMesa() {
    const det = document.getElementById('mesa-detalle');
    if (det) det.style.display = 'none';
}

// ─── QR ────────────────────────────────────────────────────
document.querySelectorAll('[data-bs-target="#tab-qr"]').forEach(btn => {
    btn.addEventListener('shown.bs.tab', () => {
        if (!qrInitialized) {
            qrInitialized = true;
            html5QrCode = new Html5Qrcode('qr-reader');
            html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: Math.min(document.getElementById('qr-reader').offsetWidth * 0.7, 350) },
                onScanSuccess
            ).catch(err => console.error('Cámara:', err));
        }
    });
});

// ─── SWEETALERT: pedir cantidad ────────────────────────────
async function pedirCantidadSwal(invitado) {
    const cupoMax = (Number(invitado?.usos_restantes) || 0);

    return new Promise(resolve => {
        let cantidad = 0;

        const updateDisplay = () => {
            const el = document.getElementById('swal-cantidad-display');
            if (el) el.textContent = cantidad;
            const btnMenos = document.getElementById('swal-menos');
            if (btnMenos) btnMenos.disabled = cantidad <= 1;
            const btnMas = document.getElementById('swal-mas');
            if (btnMas) btnMas.disabled = cantidad >= cupoMax;
        };

        Swal.fire({
            customClass: { popup: 'swal-qr-popup' },
            html: `
                <div class="swal-qr-icon-wrap">🎟️</div>
                <div class="swal-qr-nombre">${invitado ? invitado.nombre : 'Invitado'}</div>
                <div class="swal-qr-sub">${invitado ? `Mesa ${invitado.mesa || '—'} · ${cupoMax} persona${cupoMax !== 1 ? 's' : ''} en grupo` : 'QR detectado'}</div>
                <div class="swal-qr-counter">
                    <button id="swal-menos">−</button>
                    <div id="swal-cantidad-display">1</div>
                    <button id="swal-mas">+</button>
                </div>
                <div class="swal-qr-maximo">Máximo: ${cupoMax} persona${cupoMax !== 1 ? 's' : ''}</div>
            `,
            confirmButtonText: 'Registrar entrada ✓',
            confirmButtonColor: '#c9a84c',
            cancelButtonText: 'Cancelar',
            showCancelButton: true,
            focusConfirm: false,
            didOpen: () => {
                updateDisplay();
                document.getElementById('swal-menos')?.addEventListener('click', () => {
                    if (cantidad > 1) { cantidad--; updateDisplay(); }
                });
                document.getElementById('swal-mas')?.addEventListener('click', () => {
                    if (cantidad < cupoMax) { cantidad++; updateDisplay(); }
                });
            },
            preConfirm: () => cantidad
        }).then(result => {
            resolve(result.isConfirmed ? result.value : null);
        });
    });
}

// ─── SWEETALERT: mostrar resultado ─────────────────────────
function mostrarResultadoSwal(data, cantidad) {
    const restantes = data.restantes ?? '—';
    const nombre = data.nombre ?? 'Invitado';
    const msg = data.message ?? '';
    const restantesNum = Number(restantes);
    const color = Number.isFinite(restantesNum)
        ? (restantesNum === 0 ? '#ef4444' : restantesNum <= 1 ? '#f59e0b' : '#22c55e')
        : '#22c55e';
    const emoji = Number.isFinite(restantesNum) && restantesNum === 0 ? '🚫' : '✅';

    Swal.fire({
        customClass: { popup: 'swal-qr-popup' },
        html: `
            <div class="swal-resultado-ok">
                <div style="font-size:2.5rem;margin-bottom:.25rem">${emoji}</div>
                <div class="swal-resultado-label">Personas ingresadas</div>
                <div class="swal-resultado-num" style="color:${color}">${cantidad}</div>
                <div class="swal-resultado-nombre">${nombre}</div>
                ${msg ? `<div style="font-size:.8rem;color:var(--muted);margin-top:.4rem">${msg}</div>` : ''}
                <div class="swal-resultado-restantes">
                    Cupos restantes en este QR: <span class="swal-restantes-num">${restantes}</span>
                </div>
            </div>
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#c9a84c',
        timer: 3000,
        timerProgressBar: true,
    });
}

// ─── SCAN CALLBACK ─────────────────────────────────────────
async function onScanSuccess(decodedText) {
    if (escaneoEnProceso) return;
    escaneoEnProceso = true;

    if (html5QrCode) html5QrCode.pause(true);

    // ── 1. Validación estricta antes de cualquier acción ──
    const { valido, invitado: invitadoLocal, motivo } = validarUUID(decodedText);
    if (!valido) {
        mostrarErrorQR(motivo);
        const qrResult = document.getElementById('qr-result');
        if (qrResult) qrResult.innerHTML = '';
        if (html5QrCode) html5QrCode.resume();
        escaneoEnProceso = false;
        return;
    }

    // ── 2. Pedir cantidad (cupo máximo basado en usos_restantes del invitado validado) ──
    const cantidad = await pedirCantidadSwal(invitadoLocal);

    if (!cantidad) {
        const qrResult = document.getElementById('qr-result');
        if (qrResult) qrResult.innerHTML = '';
        if (html5QrCode) html5QrCode.resume();
        escaneoEnProceso = false;
        return;
    }

    // ── 3. Sin conexión: modo offline positivo ──
    const manejarOffline = (origen) => {
        agregarAlCache(decodedText, cantidad, { nombre: invitadoLocal.nombre, origen });
        aplicarEntradaLocal(decodedText, cantidad); // descuenta usos_restantes en memoria

        // Toast de confirmación offline con diseño positivo
        showToast(
            `<span style="font-size:1.1rem">📵</span> <strong>¡Modo Offline Activo!</strong><br>` +
            `<small>Acceso autorizado localmente para <em>${invitadoLocal.nombre}</em>. ` +
            `Sincronización con la nube pendiente.</small>`,
            'offline',
            4500
        );

        // Mostrar check verde de éxito en la UI
        const qrResult = document.getElementById('qr-result');
        if (qrResult) {
            qrResult.innerHTML = `
                <div class="offline-success-feedback">
                    <span class="check-icon">✅</span>
                    <span>${invitadoLocal.nombre} — <strong>${cantidad}</strong> persona${cantidad !== 1 ? 's' : ''} (offline)</span>
                </div>`;
            setTimeout(() => { qrResult.innerHTML = ''; }, 4000);
        }
    };

    if (!navigator.onLine) {
        manejarOffline('camera');
        if (html5QrCode) html5QrCode.resume();
        escaneoEnProceso = false;
        return;
    }

    // ── 4. Online: intentar fetch, si falla → fallback offline ──
    try {
        const res = await fetch(
            `${ruta}/qr?uuid=${encodeURIComponent(decodedText)}&cantidad=${cantidad}`,
            { method: 'POST' }
        );
        const data = await res.json();
        mostrarResultadoSwal(data, cantidad);
        const qrResult = document.getElementById('qr-result');
        if (qrResult) qrResult.innerHTML = '';
        cargarInvitados();
    } catch (err) {
        console.error(err);
        manejarOffline('camera-fetch-failed');
    }

    if (html5QrCode) html5QrCode.resume();
    escaneoEnProceso = false;
}

// ─── PISTOLA: PROCESAR MANUAL ─────────────────────────────
async function procesarManual() {
    const input = document.getElementById('uuid-input');
    if (!input) return;
    const uuid = input.value.trim();
    if (!uuid) return;

    // ── 1. Validación estricta antes de cualquier acción ──
    const { valido, invitado: invitadoLocal, motivo } = validarUUID(uuid);
    if (!valido) {
        mostrarErrorQR(motivo);
        input.value = '';
        return;
    }

    // ── 2. Pedir cantidad ──
    const cantidad = await pedirCantidadSwal(invitadoLocal);
    if (!cantidad) return;

    input.value = '';

    // ── 3. Sin conexión: modo offline positivo ──
    const manejarOfflineManual = () => {
        agregarAlCache(uuid, cantidad, { nombre: invitadoLocal.nombre, origen: 'manual' });
        aplicarEntradaLocal(uuid, cantidad); // descuenta usos_restantes en memoria

        // Toast positivo de modo offline
        showToast(
            `<span style="font-size:1.1rem">📵</span> <strong>¡Modo Offline Activo!</strong><br>` +
            `<small>Acceso autorizado localmente para <em>${invitadoLocal.nombre}</em>. ` +
            `Sincronización con la nube pendiente.</small>`,
            'offline',
            4500
        );

        // Check verde de éxito en el área de resultado manual
        const manualResult = document.getElementById('manual-result');
        if (manualResult) {
            manualResult.innerHTML = `
                <div class="offline-success-feedback">
                    <span class="check-icon">✅</span>
                    <span>${invitadoLocal.nombre} — <strong>${cantidad}</strong> persona${cantidad !== 1 ? 's' : ''} (offline)</span>
                </div>`;
            setTimeout(() => { manualResult.innerHTML = ''; }, 4000);
        }
    };

    if (!navigator.onLine) {
        manejarOfflineManual();
        return;
    }

    // ── 4. Online: intentar fetch, si falla → fallback offline ──
    try {
        const res = await fetch(
            `${ruta}/qr?uuid=${encodeURIComponent(uuid)}&cantidad=${cantidad}`,
            { method: 'POST' }
        );
        const data = await res.json();
        mostrarResultadoSwal(data, cantidad);
        const manualResult = document.getElementById('manual-result');
        if (manualResult) manualResult.innerHTML = '';
        cargarInvitados();
    } catch (e) {
        console.error(e);
        manejarOfflineManual();
    }
}

// ─── REGISTRAR ENTRADA DESDE TABLA (sin QR) ───────────────
/**
 * Permite registrar la entrada de un invitado directamente desde la tabla,
 * sin necesidad de escanear su QR. Reutiliza la validación y el flujo offline.
 */
async function registrarEntradaManualPorId(uuid) {
    // Validación estricta (cupo, existencia)
    const { valido, invitado, motivo } = validarUUID(uuid);
    if (!valido) {
        mostrarErrorQR(motivo);
        return;
    }

    // Pedir cantidad con el mismo Swal que el escáner
    const cantidad = await pedirCantidadSwal(invitado);
    if (!cantidad) return;

    // Fallback offline compartido
    const manejarOffline = () => {
        agregarAlCache(uuid, cantidad, { nombre: invitado.nombre, origen: 'tabla' });
        aplicarEntradaLocal(uuid, cantidad);
        showToast(
            `<span style="font-size:1.1rem">📵</span> <strong>¡Modo Offline Activo!</strong><br>` +
            `<small>Acceso autorizado localmente para <em>${invitado.nombre}</em>. ` +
            `Sincronización con la nube pendiente.</small>`,
            'offline',
            4500
        );
    };

    if (!navigator.onLine) {
        manejarOffline();
        return;
    }

    try {
        const res = await fetch(
            `${ruta}/qr?uuid=${encodeURIComponent(uuid)}&cantidad=${cantidad}`,
            { method: 'POST' }
        );
        const data = await res.json();
        mostrarResultadoSwal(data, cantidad);
        cargarInvitados();
    } catch (e) {
        console.error(e);
        manejarOffline();
    }
}

// Debounce para pistola
window.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoConexion();
    actualizarBadgesPendientes();

    const uuidInput = document.getElementById('uuid-input');
    if (uuidInput) {
        let timeout = null;
        uuidInput.addEventListener('input', () => {
            const valor = uuidInput.value.trim();
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (valor.length === 36) procesarManual();
            }, 150);
        });

        uuidInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') procesarManual();
        });
    }

    const badge = document.getElementById('cache-badge');
    if (badge) {
        badge.addEventListener('click', () => {
            if (navigator.onLine) {
                sincronizarCola();
            } else {
                showToast('Sin conexión — espera a que se restablezca');
            }
        });
    }

    const syncBtn = document.getElementById('btn-sync-queue');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            if (navigator.onLine) {
                sincronizarCola();
            } else {
                showToast('Sin conexión — la sync quedará pendiente');
            }
        });
    }
});

// ─── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', cargarInvitados);