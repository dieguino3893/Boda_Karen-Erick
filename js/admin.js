// ─── CONFIG ───────────────────────────────────────────────
const ruta = "https://netasistencia-bbckcda7hbhpdtgd.eastus-01.azurewebsites.net/asistencia";
let listaInvitados = [];
let toastInstance;

// ─── TOAST ─────────────────────────────────────────────────
function showToast(msg) {
    if (!toastInstance) toastInstance = new bootstrap.Toast(document.getElementById('alert-toast'), { delay: 2500 });
    document.getElementById('toast-body').textContent = msg;
    toastInstance.show();
}

// ─── NORMALIZAR CAMPOS ─────────────────────────────────────
// El API devuelve camelCase (usosRestantes). Esta función
// unifica todo a las claves que usa el JS internamente.
function normalizarInvitado(raw) {
    return {
        id:             raw.id             ?? raw.Id             ?? raw._id?.$oid ?? null,
        nombre:         raw.nombre         ?? raw.Nombre         ?? '',
        asistencia:     raw.asistencia     ?? raw.Asistencia     ?? null,
        invitados:      raw.invitados      ?? raw.Invitados      ?? 0,
        mesa:           raw.mesa           ?? raw.Mesa           ?? null,
        uuid:           raw.uuid           ?? raw.Uuid           ?? null,
        usos_restantes: raw.usos_restantes ?? raw.UsosRestantes  ?? raw.usosRestantes ?? null,
        fecha_registro: raw.fecha_registro ?? raw.FechaRegistro  ?? null,
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
    } catch (e) {
        console.error("Error cargando invitados:", e);
    }
}

// ─── STATS GLOBALES ────────────────────────────────────────
function actualizarStats() {
    const total        = listaInvitados.length;
    const confirmados  = listaInvitados.filter(i => i.asistencia === true).length;
    const pendientes   = listaInvitados.filter(i => i.asistencia === null).length;
    const rechazados   = listaInvitados.filter(i => i.asistencia === false).length;
    const enFiesta     = calcularEnFiesta();
    const mesasActivas = new Set(listaInvitados.filter(i => i.mesa).map(i => i.mesa)).size;

    document.getElementById('stat-total').textContent       = total;
    document.getElementById('stat-confirmados').textContent = confirmados;
    document.getElementById('stat-pendientes').textContent  = pendientes;
    document.getElementById('stat-rechazados').textContent  = rechazados;
    document.getElementById('stat-fiesta').textContent      = enFiesta;
    document.getElementById('stat-mesas').textContent       = mesasActivas;

    document.getElementById('fiesta-total').textContent      = enFiesta;
    document.getElementById('chip-confirmados').textContent  = confirmados;
    const totalAcomp = listaInvitados.reduce((a, i) => a + (Number(i.invitados) || 0), 0);
    document.getElementById('chip-acompanantes').textContent = totalAcomp;
}

// ─── CALCULAR EN FIESTA ────────────────────────────────────
// hanEntrado = cupoMaximo - usos_restantes
// cupoMaximo = invitados (acompañantes) + 1 (titular)
function calcularEnFiesta() {
    return listaInvitados.reduce((total, inv) => {
        if (inv.asistencia !== true) return total;
        const cupoMaximo = (Number(inv.invitados) || 0) + 1;
        const restantes  = inv.usos_restantes ?? cupoMaximo;
        return total + Math.max(0, cupoMaximo - restantes);
    }, 0);
}

// ─── RENDER TABLA INVITADOS ────────────────────────────────
function renderizarTabla(datos) {
    const tbody = document.getElementById("invitados-tbody");
    tbody.innerHTML = "";
    document.getElementById('contador-lista').textContent = `${datos.length} registro${datos.length !== 1 ? 's' : ''}`;

    datos.forEach((inv, index) => {
        const asistBadge = inv.asistencia === null
            ? `<span class="badge-pendiente">Pendiente</span>`
            : inv.asistencia
                ? `<span class="badge-confirmado">Confirmado</span>`
                : `<span class="badge-rechazado">No asiste</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="color:var(--muted);font-size:.78rem">${index + 1}</td>
            <td><input type="text" id="nombre-${inv.id}" class="form-control form-control-sm" value="${inv.nombre}" placeholder="Nombre"></td>
            <td>${asistBadge}</td>
            <td><input type="number" id="acompanantes-${inv.id}" class="form-control form-control-sm" value="${inv.invitados}" placeholder="0" style="width:70px"></td>
            <td><input type="number" id="mesa-${inv.id}" class="form-control form-control-sm" value="${inv.mesa || ''}" placeholder="—" style="width:70px"></td>
            <td>
                <div class="d-flex gap-1 flex-wrap">
                    <button class="btn btn-outline-gold" onclick="Actualizar('${inv.id}')">Guardar</button>
                    <button class="btn btn-outline-muted" onclick="copiarEnlace('${inv.uuid}')">Copiar</button>
                    <button class="btn btn-outline-danger-soft" onclick="eliminarInvitado('${inv.id}')">Eliminar</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

function aplicarFiltros() {
    const q     = document.getElementById("search-name").value.toLowerCase();
    const asist = document.getElementById("filter-asistencia").value;
    const mesa  = document.getElementById("filter-mesa").value.toLowerCase();

    const filtrados = listaInvitados.filter(inv => {
        const nombre = inv.nombre.toLowerCase().includes(q);
        const mesaOk = (inv.mesa || "").toString().toLowerCase().includes(mesa);
        let asistOk  = true;
        if (asist === "confirmados") asistOk = inv.asistencia === true;
        if (asist === "pendientes")  asistOk = inv.asistencia === null;
        if (asist === "rechazados")  asistOk = inv.asistencia === false;
        return nombre && mesaOk && asistOk;
    });

    renderizarTabla(filtrados);
}

// ─── ACTUALIZAR ────────────────────────────────────────────
async function Actualizar(id) {
    const nombre = document.getElementById(`nombre-${id}`).value;
    const acomp  = document.getElementById(`acompanantes-${id}`).value;
    const mesa   = document.getElementById(`mesa-${id}`).value;
    if (!nombre) return;

    await fetch(ruta + `/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Nombre: nombre, Mesa: Number(mesa) || null, Invitados: Number(acomp) })
    });
    showToast(`✓ "${nombre}" actualizado — Mesa ${mesa || 'sin asignar'}`);
    cargarInvitados();
}

async function eliminarInvitado(id) {
    if (!confirm("¿Seguro que deseas eliminar este invitado?")) return;
    await fetch(ruta + `/${id}`, { method: "DELETE" });
    cargarInvitados();
}

function copiarEnlace(uuid) {
    if (!uuid) return alert('UUID no disponible');
    const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
    const link = `${origin}/?datos=${encodeURIComponent(uuid)}`;
    navigator.clipboard.writeText(link).then(() => showToast(`✓ Enlace copiado`)).catch(() => alert('No se pudo copiar.'));
}

async function agregarInvitado() {
    const nombre = document.getElementById('nuevo-nombre').value.trim();
    const acomp  = Number(document.getElementById('nuevo-invitados').value || 0);
    const mesa   = Number(document.getElementById('nuevo-mesa').value || 0);
    if (!nombre) return alert('Nombre es requerido');

    const payload = { nombre, invitados: acomp, ...(mesa ? { mesa } : {}) };
    const res = await fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) return alert('Error al crear invitado');

    showToast(`✓ Invitado agregado: ${nombre}`);
    document.getElementById('add-invitado-form').reset();
    cargarInvitados();
}

// ─── PANEL DE MESAS ────────────────────────────────────────
// - Solo se renderizan las mesas que existen en la colección.
// - capacidad = suma de (invitados + 1) de grupos con asistencia === true.
//     Ej: 3 grupos × (4 acompañantes + 1 titular) = 15 sillas.
// - presentes = suma de (cupoGrupo - usos_restantes) → los que ya escanearon QR.
function renderMesas() {
    const porMesa = {};

    listaInvitados.forEach(inv => {
        const m = inv.mesa;
        if (!m) return;

        if (!porMesa[m]) porMesa[m] = { capacidad: 0, presentes: 0, grupos: 0 };

        const cupoGrupo  = (Number(inv.invitados) || 0) + 1;
        const restantes  = inv.usos_restantes ?? cupoGrupo;
        const hanEntrado = Math.max(0, cupoGrupo - restantes);

        if (inv.asistencia === true) {
            porMesa[m].capacidad += cupoGrupo;
        }

        porMesa[m].presentes += hanEntrado;
        porMesa[m].grupos    += 1;
    });

    // Solo las mesas que existen, ordenadas numéricamente
    const mesasOrdenadas = Object.keys(porMesa).map(Number).sort((a, b) => a - b);

    const grid = document.getElementById('mesas-grid');
    grid.innerHTML = '';
    let mesasCompletas = 0;

    mesasOrdenadas.forEach(m => {
        const s = porMesa[m];

        const pct   = s.capacidad > 0 ? Math.min(s.presentes / s.capacidad, 1) : 0;
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
    document.getElementById('mesa-detalle-titulo').textContent =
        `Mesa ${numMesa} — ${invitadosMesa.length} grupo${invitadosMesa.length !== 1 ? 's' : ''}`;

    const tbody = document.getElementById('mesa-detalle-tbody');
    tbody.innerHTML = '';

    // Agregar columna Entradas al thead si no existe
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
            const cupoGrupo  = (Number(inv.invitados) || 0) + 1;
            const restantes  = inv.usos_restantes ?? cupoGrupo;
            const hanEntrado = Math.max(0, cupoGrupo - restantes);

            const asistBadge = inv.asistencia === null
                ? `<span class="badge-pendiente">Pendiente</span>`
                : inv.asistencia
                    ? `<span class="badge-confirmado">Confirmado</span>`
                    : `<span class="badge-rechazado">No asiste</span>`;

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
    det.style.display = '';
    det.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cerrarDetalleMesa() {
    document.getElementById('mesa-detalle').style.display = 'none';
}

// ─── QR ────────────────────────────────────────────────────
let html5QrCode;
let qrInitialized = false;

document.querySelectorAll('[data-bs-target="#tab-qr"]').forEach(btn => {
    btn.addEventListener('shown.bs.tab', () => {
        if (!qrInitialized) {
            qrInitialized = true;
            html5QrCode = new Html5Qrcode("qr-reader");
            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: Math.min(document.getElementById('qr-reader').offsetWidth * 0.7, 350) },
                onScanSuccess
            ).catch(err => console.error("Cámara:", err));
        }
    });
});

function onScanSuccess(decodedText) {
    const cantidad = prompt("¿Cuántas personas entran con este QR?");
    if (!cantidad || isNaN(cantidad) || Number(cantidad) <= 0) {
        document.getElementById("qr-result").innerHTML = `<div class="alert alert-warning">Cantidad inválida</div>`;
        return;
    }

    fetch(`${ruta}/qr?uuid=${encodeURIComponent(decodedText)}&cantidad=${cantidad}`, { method: "POST" })
        .then(r => r.json())
        .then(data => {
            document.getElementById("qr-result").innerHTML = `
                <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--champagne);border-radius:8px;padding:1rem">
                    <strong>${data.nombre}</strong><br>
                    ${data.message || ''}<br>
                    Restantes: <strong>${data.restantes}</strong>
                </div>`;
            if (html5QrCode) html5QrCode.stop();
            cargarInvitados();
        })
        .catch(err => {
            console.error(err);
            document.getElementById("qr-result").innerHTML = `<div style="color:#e07070">Error al procesar QR</div>`;
        });
}

// ─── INIT ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", cargarInvitados);