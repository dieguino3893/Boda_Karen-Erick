let toast;
let listaInvitados = []; // Variable global para guardar los datos del fetch
const ruta = "https://netasistencia-bbckcda7hbhpdtgd.eastus-01.azurewebsites.net/asistencia";

async function cargarInvitados() {
    try {
        const res = await fetch(ruta);
        listaInvitados = await res.json(); // Guardamos los datos
        renderizarTabla(listaInvitados);  // Dibujamos la tabla original
    } catch (error) {
        console.error("Error cargando invitados:", error);
    }
}

// Nueva función que separa la lógica de "dibujar" de la de "cargar"
function renderizarTabla(datos) {
    const tbody = document.getElementById("invitados-tbody");
    tbody.innerHTML = "";

    datos.forEach((inv, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <input type="text" id="nombre-${inv.id}" class="form-control form-control-sm" value="${inv.nombre}" placeholder="Nombre">
            </td>
            <td>${inv.asistencia === null ? "No confirmado" : inv.asistencia ? "Sí" : "No"} </td>
            <td>
                <input type="number" id="acompanantes-${inv.id}" class="form-control form-control-sm" value="${inv.invitados}" placeholder="Acompañantes">
            </td>
            <td>
                <input type="text" id="mesa-${inv.id}" class="form-control form-control-sm" value="${inv.mesa || ''}" placeholder="Mesa">
            </td>

            <td>
                <div class="btn-group" role="group">
                  <button class="btn btn-success btn-sm" onclick="Actualizar('${inv.id}')">Actualizar</button>
                  <button class="btn btn-secondary btn-sm" onclick="copiarEnlace('${inv.uuid}')">Copiar</button>
                  <button class="btn btn-danger btn-sm" onclick="eliminarInvitado('${inv.id}')">Eliminar</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Esta es la función mágica que combina los 3 filtros
function aplicarFiltros() {
    const busquedaNombre = document.getElementById("search-name").value.toLowerCase();
    const filtroAsistencia = document.getElementById("filter-asistencia").value;
    const busquedaMesa = document.getElementById("filter-mesa").value.toLowerCase();

    const invitadosFiltrados = listaInvitados.filter(inv => {
        // 1. Filtro Nombre
        const cumpleNombre = inv.nombre.toLowerCase().includes(busquedaNombre);

        // 2. Filtro Mesa
        const cumpleMesa = (inv.mesa || "").toString().toLowerCase().includes(busquedaMesa);

        // 3. Filtro Asistencia
        let cumpleAsistencia = true;
        if (filtroAsistencia === "confirmados") cumpleAsistencia = inv.asistencia === true;
        if (filtroAsistencia === "pendientes") cumpleAsistencia = inv.asistencia === null;
        if (filtroAsistencia === "rechazados") cumpleAsistencia = inv.asistencia === false;

        return cumpleNombre && cumpleMesa && cumpleAsistencia;
    });

    renderizarTabla(invitadosFiltrados);
}

        async function Actualizar(id) {
            const mesa = document.getElementById(`mesa-${id}`).value;
            const nombre = document.getElementById(`nombre-${id}`).value;
            const acompañantes = document.getElementById(`acompanantes-${id}`).value;

            if (!mesa || !nombre) return;

            await fetch(ruta + `/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Nombre: nombre,
                    Mesa: Number(mesa),
                    Invitados: Number(acompañantes)
                })
            });

            // Toast
            if (!toast) {
                toast = new bootstrap.Toast(
                    document.getElementById('alert-toast'),
                    { delay: 2000 }
                );
            }

            document.getElementById('toast-body').textContent =
                `Invitado "${nombre}" actualizado. Mesa ${mesa}.`;

            toast.show();

            cargarInvitados();
        }

        async function eliminarInvitado(id) {
            if (!confirm("¿Seguro que deseas eliminar esta invitación?")) return;
            await fetch(ruta + `/${id}`, { method: "DELETE" });
            cargarInvitados();
        }
        
        // Copiar enlace público para que el invitado acceda a /test.html/{uuid}
        function copiarEnlace(uuid) {
            if (!uuid) return alert('UUID no disponible');
            const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
            // Usar query param 'datos' para evitar problemas con servidores que tratan segmentos como rutas físicas
            const link = `${origin}/?datos=${encodeURIComponent(uuid)}`;
            navigator.clipboard.writeText(link).then(() => {
                if (!toast) {
                    toast = new bootstrap.Toast(document.getElementById('alert-toast'), { delay: 2000 });
                }
                document.getElementById('toast-body').textContent = `Enlace copiado: ${link}`;
                toast.show();
            }).catch(err => {
                console.error('Error copiando enlace', err);
                alert('No se pudo copiar el enlace.');
            });
        }

        // Agregar nuevo invitado desde el formulario
        async function agregarInvitado() {
            const nombre = document.getElementById('nuevo-nombre').value.trim();
            const invitadosNum = Number(document.getElementById('nuevo-invitados').value || 0);
            if (!nombre) return alert('Nombre es requerido');

            const payload = { nombre: nombre, invitados: invitadosNum };
            const res = await fetch(ruta, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(()=>null);
                console.error('Error al crear invitado', err);
                return alert('Error al crear invitado');
            }

            const data = await res.json();
            if (!toast) {
                toast = new bootstrap.Toast(document.getElementById('alert-toast'), { delay: 2000 });
            }
            document.getElementById('toast-body').textContent = `Invitado agregado: ${nombre}`;
            toast.show();

            // Limpiar formulario
            document.getElementById('add-invitado-form').reset();

            // Recargar tabla
            cargarInvitados();
        }

function onScanSuccess(decodedText) {
    console.log(`QR Escaneado: ${decodedText}`);
    const resultDiv = document.getElementById("qr-result");

    // 🔥 PREGUNTAR CUÁNTOS VIENEN
    const cantidad = prompt("¿Cuántas personas entran con este QR?");

    if (!cantidad || isNaN(cantidad) || Number(cantidad) <= 0) {
        resultDiv.innerHTML = `<div class="alert alert-warning">Cantidad inválida</div>`;
        return;
    }

    fetch(`${ruta}/qr?uuid=${encodeURIComponent(decodedText)}&cantidad=${cantidad}`, {
        method: "POST"
    })
    .then(res => res.json())
    .then(data => {
        if (data.modo === "consulta") {
            resultDiv.innerHTML = `
                <div class="alert alert-info">
                    <strong>${data.nombre}</strong><br>
                    Invitados: ${data.invitados}<br>
                    Restantes: ${data.restantes}
                </div>
            `;
        } else {
            // 🔥 CONSUMO
            resultDiv.innerHTML = `
                <div class="alert ${data.restantes >= 0 ? 'alert-success' : 'alert-danger'}">
                    <strong>${data.nombre}</strong><br>
                    ${data.message}<br>
                    Restantes: ${data.restantes}
                </div>
            `;
        }

        // 🔥 DETENER ESCÁNER PARA EVITAR DOBLE LECTURA
        html5QrCode.stop();
    })
    .catch(err => {
        console.error(err);
        resultDiv.innerHTML = `<div class="alert alert-danger">Error al procesar QR</div>`;
        html5QrCode.stop();
    });
}

// Inicializar lector QR
const qrContainer = document.getElementById("qr-reader");
function getQrBoxSize() {
    // Tamaño del recuadro QR: 70% del ancho del contenedor, máximo 400px
    const width = qrContainer.offsetWidth;
    return Math.min(width * 0.7, 400);
}
const html5QrCode = new Html5Qrcode("qr-reader");
html5QrCode.start(
    { facingMode: "environment" }, // usa la cámara trasera si está disponible
    {
        fps: 10,    // escanea 10 veces por segundo
        qrbox: getQrBoxSize() // tamaño del recuadro QR
    },
    onScanSuccess
).catch(err => {
    console.error("Error inicializando la cámara", err);
});


// Actualizar qrbox si la ventana cambia de tamaño
window.addEventListener("resize", () => {
    html5QrCode.stop().then(() => {
        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: getQrBoxSize() },
            onScanSuccess
        );
    }).catch(console.error);
});


        function filtrarTabla() {
            const input = document.getElementById("search-name").value.toLowerCase();
            const rows = document.querySelectorAll("#invitados-tbody tr");
            rows.forEach(row => {
                const nombre = row.children[1].textContent.toLowerCase();
                row.style.display = nombre.includes(input) ? "" : "none";
            });
        }

        document.addEventListener("DOMContentLoaded", cargarInvitados);