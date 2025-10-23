  let toast;
        const ruta = "https://netasistencia-bbckcda7hbhpdtgd.eastus-01.azurewebsites.net/asistencia"
        async function cargarInvitados() {
            const res = await fetch(ruta);
            const invitados = await res.json();
            const tbody = document.getElementById("invitados-tbody");
            tbody.innerHTML = "";

            invitados.forEach((inv, index) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${inv.nombre}</td>
                    <td>${inv.asistencia ? "Sí" : "No"}</td>
                    <td>${inv.invitados}</td>
                    <td>
                        <input type="text" id="mesa-${inv.id}" class="form-control form-control-sm" value="${inv.mesa || ''}" placeholder="Mesa">
                    </td>
                    <td>${inv.fecha_registro ? new Date(inv.fecha_registro).toLocaleString() : ''}</td>
                    <td>
                        <button class="btn btn-success btn-sm me-1" onclick="asignarMesa('${inv.id}')">Asignar</button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarInvitado('${inv.id}')">Eliminar</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function asignarMesa(id) {
            const mesa = document.getElementById(`mesa-${id}`).value;
            if (!mesa) return;
            await fetch(ruta + `/${id}/mesa`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mesa })
            });

            // Mostrar alerta tipo toast
            if (!toast) {
                toast = new bootstrap.Toast(document.getElementById('alert-toast'), { delay: 2000 });
            }
            document.getElementById('toast-body').textContent = `Mesa "${mesa}" asignada a invitado ${id}!`;
            toast.show();

            cargarInvitados();
        }

        async function eliminarInvitado(id) {
            if (!confirm("¿Seguro que deseas eliminar esta invitación?")) return;
            await fetch(ruta + `/${id}`, { method: "DELETE" });
            cargarInvitados();
        }
function onScanSuccess(decodedText) {
    // decodedText es el contenido del QR
    console.log(`QR Escaneado: ${decodedText}`);
    const resultDiv = document.getElementById("qr-result");

   // Consultar backend con el UUID escaneado
fetch(ruta  + `/qr/${encodeURIComponent(decodedText)}`)
    .then(res => {
        if (!res.ok) {
            throw new Error("Invitado no encontrado");
        }
        return res.json();
    })
    .then(invitado => {
        if (!invitado) {
            resultDiv.innerHTML = `<div class="alert alert-warning">Invitado no encontrado</div>`;
            return;
        }

        resultDiv.innerHTML = `
            <div class="alert alert-info">
                <strong>Nombre:</strong> ${invitado.nombre} <br>
                <strong>Asistencia:</strong> ${invitado.asistencia ? "Sí" : "No"} <br>
                <strong>Acompañantes:</strong> ${invitado.invitados} <br>
                <strong>Mesa:</strong> ${invitado.mesa || 'Sin asignar'} <br>
                <strong>ID:</strong> ${invitado.id} <br>
                <strong>Fecha de registro:</strong> ${new Date(invitado.fecha_registro).toLocaleString()}
            </div>
        `;
    })
    .catch(err => {
        console.error(err);
        resultDiv.innerHTML = `<div class="alert alert-danger">Error al buscar invitado</div>`;
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