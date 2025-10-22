document.addEventListener("DOMContentLoaded", () => {
    // ---------- PING para despertar el servidor ----------
    // Se envía una petición al cargar la página para asegurar que el backend esté activo.
    fetch("https://netasistencia-bbckcda7hbhpdtgd.eastus-01.azurewebsites.net/asistencia/wakeup")
        .then(res => res.json())
        .then(data => console.log(data.message || "Ping al servidor completado."))
        .catch(err => console.error("No se pudo hacer ping al servidor (puede estar iniciándose):", err));

    // ---------- 1. Animación con Intersection Observer ----------
    const fadeElements = document.querySelectorAll("h1, h2, p, img, .box, .container-img");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.transition = "opacity 0.4s ease, transform 0.4s ease";
                entry.target.style.opacity = 1;
                entry.target.style.transform = "translateY(0)";
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    fadeElements.forEach(el => {
        el.style.opacity = 0;
        el.style.transform = "translateY(30px)";
        observer.observe(el);
    });

    // ---------- 2. Animación en números (cuenta regresiva) ----------
    const numbers = document.querySelectorAll(".box-date .date");
    const values = [0, 9, 0, 0];
    numbers.forEach((num, index) => {
        let count = 0;
        const interval = setInterval(() => {
            num.textContent = count;
            if (count >= values[index]) clearInterval(interval);
            count++;
        }, 80);
    });

    // ---------- 3. Hover animado en imágenes (zoom) ----------
    const galleryImages = document.querySelectorAll(".container-img .box-img img");
    galleryImages.forEach(img => {
        img.style.transition = "transform 0.3s ease";
        img.addEventListener("mouseover", () => img.style.transform = "scale(1.1)");
        img.addEventListener("mouseout", () => img.style.transform = "scale(1)");
    });

    // ---------- 4. Botón "Ver Ubicación" efecto pulsante ----------
    const button = document.querySelector(".ubication");
    if (button) {
        setInterval(() => {
            button.animate([
                { transform: "scale(1)", backgroundColor: "#B7AA92" },
                { transform: "scale(1.1)", backgroundColor: "#a49780" },
                { transform: "scale(1)", backgroundColor: "#B7AA92" }
            ], { duration: 800, iterations: 1 });
        }, 1500);
    }

    // ---------- 5. Activar música al primer clic ----------
    const music = document.getElementById("bg-music");
    if (music) {
        document.addEventListener("click", () => {
            if (music.paused) music.play().catch(err => console.log("Autoplay bloqueado:", err));
        }, { once: true });
    }

    // ---------- 6. Countdown overlay ----------
    const weddingDate = new Date("2025-09-27T19:00:00");

    function updateOverlayCountdown() {
        const now = new Date();
        const diff = weddingDate - now;
        if (diff <= 0) {
            const overlay = document.querySelector('.countdown-overlay');
            if (overlay) overlay.textContent = "¡Nuestro gran día ha llegado!";
            return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        const ids = ["days", "hours", "minutes", "seconds"];
        const values = [days, hours, minutes, seconds];
        ids.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el && el.firstChild) el.firstChild.textContent = values[i].toString().padStart(2, "0");
        });
    }
    setInterval(updateOverlayCountdown, 1000);
    updateOverlayCountdown();

    
// ---------- 7. Formulario RSVP + QR ----------
const rsvpForm = document.getElementById("rsvp-form");
const downloadBtn = document.getElementById("download-qr");
let qrCodeElement = null;

if (rsvpForm) {
    rsvpForm.addEventListener("submit", (e) => {
        e.preventDefault();
         const messageEl = document.getElementById("form-message");
        const Nombre = document.getElementById("name").value;
        const attendanceValue = document.getElementById("attendance").value;
        const Asistencia = attendanceValue.toLowerCase() === "si"; // true si "si", false si "no"
        const Invitados = parseInt(document.getElementById("guests").value, 10);
        // Fecha de registro en formato ISO (compatible con DATETIME de SQL Server)
        const fecha_registro = new Date().toISOString();
        if (messageEl) messageEl.textContent = "Por favor espera... no olvides descargar tu invitación QR si asistirás.";
        fetch("https://netasistencia-bbckcda7hbhpdtgd.eastus-01.azurewebsites.net/asistencia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({Nombre, Asistencia, Invitados, fecha_registro})
        })
        .then(res => res.json())
        .then(data => {
            if (!Asistencia) {
                if (messageEl) messageEl.textContent = "Una pena que no puedas asistir. Gracias por avisar.";
            } else {
                if (messageEl) messageEl.textContent = "¡Gracias por confirmar! Por favor descarga tu invitación QR 🥳";
            }
            const qrContainer = document.getElementById("qrcode");

            // Limpiar QR previo
            if (qrContainer) qrContainer.innerHTML = "";
            if (qrCodeElement && qrCodeElement.clear) qrCodeElement.clear();
            qrCodeElement = null;

            if (Asistencia && data.uuid) {
                // Generar nuevo QR solo si asistirá
                qrCodeElement = new QRCode(qrContainer, {
                    text: data.uuid,
                    width: 256,
                    height: 256,
                    colorLight: "#ffffff" // Fondo blanco para la zona de silencio
                });

                if (downloadBtn) downloadBtn.style.display = "inline-block";
            } else {
                // Si no asistirá, ocultar el botón
                if (downloadBtn) downloadBtn.style.display = "none";
            }
        })
        .catch(err => {
            console.error(err);
            const messageEl = document.getElementById("form-message");
            if (messageEl) messageEl.textContent = "Error al enviar la asistencia. Intenta más tarde.";
        });
    });
}

// Descargar QR como imagen con marco dorado
if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
        // Esperar un poco para asegurar que la imagen esté cargada
        setTimeout(() => {
            const qrImg = document.querySelector("#qrcode img");
            const qrCanvas = document.querySelector("#qrcode canvas");
            
            // Buscar primero el canvas, luego la imagen
            const sourceElement = qrCanvas || qrImg;
            
            if (!sourceElement) {
                alert("Por favor espera un momento e intenta nuevamente.");
                console.error("No se encontró el QR para descargar.");
                return;
            }

            // Crear un canvas para añadir el borde blanco (quiet zone) y marco dorado
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const border = 20; // 20px de borde blanco
            
            // Obtener tamaño del QR
            let qrSize;
            if (qrCanvas) {
                qrSize = qrCanvas.width;
            } else {
                qrSize = qrImg.naturalWidth || qrImg.width || 256;
            }

            canvas.width = qrSize + border * 2;
            canvas.height = qrSize + border * 2;

            // 1. Rellenar el fondo de blanco
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Dibujar marco dorado decorativo
            const frameWidth = 8;
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, "#D4AF37");
            gradient.addColorStop(0.5, "#F4E5C3");
            gradient.addColorStop(1, "#D4AF37");
            
            // Marco exterior dorado
            ctx.strokeStyle = gradient;
            ctx.lineWidth = frameWidth;
            ctx.strokeRect(frameWidth/2, frameWidth/2, canvas.width - frameWidth, canvas.height - frameWidth);
            
            // Línea decorativa interna
            ctx.strokeStyle = "#C9A961";
            ctx.lineWidth = 2;
            ctx.strokeRect(frameWidth + 3, frameWidth + 3, canvas.width - (frameWidth + 3)*2, canvas.height - (frameWidth + 3)*2);
            
            // Detalles de esquina
            const cornerSize = 20;
            ctx.strokeStyle = "#D4AF37";
            ctx.lineWidth = 3;
            // Esquina superior izquierda
            ctx.beginPath();
            ctx.moveTo(frameWidth + 8, frameWidth + cornerSize);
            ctx.lineTo(frameWidth + 8, frameWidth + 8);
            ctx.lineTo(frameWidth + cornerSize, frameWidth + 8);
            ctx.stroke();
            // Esquina superior derecha
            ctx.beginPath();
            ctx.moveTo(canvas.width - frameWidth - cornerSize, frameWidth + 8);
            ctx.lineTo(canvas.width - frameWidth - 8, frameWidth + 8);
            ctx.lineTo(canvas.width - frameWidth - 8, frameWidth + cornerSize);
            ctx.stroke();
            // Esquina inferior izquierda
            ctx.beginPath();
            ctx.moveTo(frameWidth + 8, canvas.height - frameWidth - cornerSize);
            ctx.lineTo(frameWidth + 8, canvas.height - frameWidth - 8);
            ctx.lineTo(frameWidth + cornerSize, canvas.height - frameWidth - 8);
            ctx.stroke();
            // Esquina inferior derecha
            ctx.beginPath();
            ctx.moveTo(canvas.width - frameWidth - cornerSize, canvas.height - frameWidth - 8);
            ctx.lineTo(canvas.width - frameWidth - 8, canvas.height - frameWidth - 8);
            ctx.lineTo(canvas.width - frameWidth - 8, canvas.height - frameWidth - cornerSize);
            ctx.stroke();

            // 3. Dibujar el QR sobre el fondo blanco
            if (qrCanvas) {
                ctx.drawImage(qrCanvas, border, border);
            } else {
                // Asegurar que la imagen esté cargada
                if (qrImg.complete) {
                    ctx.drawImage(qrImg, border, border, qrSize, qrSize);
                } else {
                    qrImg.onload = () => {
                        ctx.drawImage(qrImg, border, border, qrSize, qrSize);
                        descargarCanvas(canvas);
                    };
                    return;
                }
            }

            descargarCanvas(canvas);
        }, 300); // Pequeño delay para asegurar que el QR esté renderizado
    });
}

function descargarCanvas(canvas) {
    // Descargar
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        // iOS: abrir en nueva pestaña
        window.open(canvas.toDataURL("image/png"), "_blank");
    } else {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "invitacion_qr.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


// ---------- 8. Gestión de invitados según asistencia ----------
const attendanceSelect = document.getElementById("attendance");
const guestsContainer = document.getElementById("guests-text");
const guestsInput = document.getElementById("guests");

if (attendanceSelect && guestsContainer && guestsInput) {
    guestsContainer.style.display = "block"; 
    guestsInput.disabled = true;// ocultar contenedor completo
    attendanceSelect.addEventListener("change", () => {
        if (attendanceSelect.value === "si") {
            guestsContainer.style.display = "block";
            guestsInput.disabled = false;
        } else {
            guestsContainer.style.display = "block";
            guestsInput.disabled = true;
            guestsInput.value = 0;
        }
    });
}

    // ---------- 9. Navegación con scroll y menú ----------
    const menuLinks = document.querySelectorAll(".panel-navegacion ul li a");
    if (menuLinks.length > 0) {
        let isScrolling = false;
        let scrollTimeout;

        function activarMenu(id) {
            menuLinks.forEach(link => {
                link.parentElement.classList.remove("activo");
                if (link.getAttribute("href") === `#${id}`) link.parentElement.classList.add("activo");
            });
        }

        function getSectionInView() {
            const secciones = [
                { id: 'galeria', element: document.getElementById('galeria') },
                { id: 'itinerario', element: document.getElementById('itinerario') },
                { id: 'asistencia', element: document.getElementById('asistencia') },
                { id: 'regalos', element: document.getElementById('regalos') }
            ].filter(sec => sec.element);

            let currentSection = null;
            let maxVisibleArea = 0;

            secciones.forEach(sec => {
                const rect = sec.element.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const visibleTop = Math.max(0, rect.top);
                const visibleBottom = Math.min(windowHeight, rect.bottom);
                const visibleHeight = Math.max(0, visibleBottom - visibleTop);
                const sectionCenter = (rect.top + rect.bottom) / 2;
                const windowCenter = windowHeight / 2;
                const distanceFromCenter = Math.abs(sectionCenter - windowCenter);

                if (visibleHeight > maxVisibleArea) {
                    maxVisibleArea = visibleHeight;
                    currentSection = sec.id;
                }

                if (visibleHeight > windowHeight * 0.3 && distanceFromCenter < windowHeight * 0.2) {
                    currentSection = sec.id;
                }
            });
            return currentSection;
        }

        function handleScroll() {
            if (!isScrolling) {
                isScrolling = true;
                requestAnimationFrame(() => {
                    const currentSection = getSectionInView();
                    if (currentSection) activarMenu(currentSection);
                    isScrolling = false;
                });
            }
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const currentSection = getSectionInView();
                if (currentSection) activarMenu(currentSection);
            }, 100);
        }

        window.addEventListener('scroll', handleScroll, { passive: true });

        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    activarMenu(targetId);
                    setTimeout(() => {
                        const currentSection = getSectionInView();
                        if (currentSection) activarMenu(currentSection);
                    }, 1000);
                }
            });
        });

        // Inicializar menú al cargar
        setTimeout(() => {
            const currentSection = getSectionInView();
            if (currentSection) activarMenu(currentSection);
        }, 100);

        // Recalcular al cambiar tamaño
        window.addEventListener('resize', () => {
            setTimeout(() => {
                const currentSection = getSectionInView();
                if (currentSection) activarMenu(currentSection);
            }, 100);
        });
    }
});