document.addEventListener("DOMContentLoaded", () => {

    /* ---------- PING BACKEND ---------- */
    fetch("https://vellum-services.runasp.net/asistencia/wakeup")
        .then(res => res.json())
        .then(data => console.log(data.message || "Ping al servidor completado."))
        .catch(() => {});

    /* ---------- 1. INTERSECTION OBSERVER ---------- */
    const fadeElements = document.querySelectorAll("h1, h2, p, img, .box, .container-img");
    const observer = new IntersectionObserver(entries => {
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


    /* ---------- 3. MÚSICA ---------- */
    const music = document.getElementById("bg-music");
    if (music) {
        document.addEventListener("click", () => {
            if (music.paused) music.play().catch(() => {});
        }, { once: true });
    }

    /* ---------- 4. COUNTDOWN ---------- */
    const weddingDate = new Date("2026-04-25T04:00:00");

    function updateOverlayCountdown() {
        const diff = weddingDate - new Date();
        if (diff <= 0) return;

        const d = Math.floor(diff / 86400000);
        const h = Math.floor(diff / 3600000) % 24;
        const m = Math.floor(diff / 60000) % 60;
        const s = Math.floor(diff / 1000) % 60;

        const map = { days: d, hours: h, minutes: m, seconds: s };
        Object.entries(map).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && el.firstChild) {
                el.firstChild.textContent = val.toString().padStart(2, "0");
            }
        });
    }

    setInterval(updateOverlayCountdown, 1000);
    updateOverlayCountdown();

    /* ---------- 5. NAVEGACIÓN LATERAL ---------- */
    const menuLinks = document.querySelectorAll(".panel-navegacion ul li a");
    if (menuLinks.length) {

        function activarMenu(id) {
            menuLinks.forEach(link => {
                link.parentElement.classList.toggle(
                    "activo",
                    link.getAttribute("href") === `#${id}`
                );
            });
        }

        function getSectionInView() {
            return ["galeria", "itinerario", "asistencia", "regalos"]
                .map(id => ({ id, el: document.getElementById(id) }))
                .filter(s => s.el)
                .reduce((best, sec) => {
                    const r = sec.el.getBoundingClientRect();
                    const visible = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
                    return visible > best.visible ? { id: sec.id, visible } : best;
                }, { id: null, visible: 0 }).id;
        }

        window.addEventListener("scroll", () => {
            const current = getSectionInView();
            if (current) activarMenu(current);
        }, { passive: true });

        menuLinks.forEach(link => {
            link.addEventListener("click", e => {
                e.preventDefault();
                document.querySelector(link.getAttribute("href"))
                    ?.scrollIntoView({ behavior: "smooth" });
            });
        });
    }

    /* ---------- 6. LIGHTBOX GALERÍA ---------- */
    const galleryImages = document.querySelectorAll('.container-img .box-img img');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    
    let currentImageIndex = 0;
    const imageSources = Array.from(galleryImages).map(img => img.src);

    function openLightbox(index) {
        currentImageIndex = index;
        lightboxImg.src = imageSources[currentImageIndex];
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    function showPrevImage() {
        currentImageIndex = (currentImageIndex - 1 + imageSources.length) % imageSources.length;
        lightboxImg.src = imageSources[currentImageIndex];
    }

    function showNextImage() {
        currentImageIndex = (currentImageIndex + 1) % imageSources.length;
        lightboxImg.src = imageSources[currentImageIndex];
    }

    // Event listeners para las imágenes
    galleryImages.forEach((img, index) => {
        img.addEventListener('click', () => openLightbox(index));
    });

    // Event listeners para controles
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrevImage);
    lightboxNext.addEventListener('click', showNextImage);
    
    // Cerrar con click en fondo
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // Navegación con teclado
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') showPrevImage();
        if (e.key === 'ArrowRight') showNextImage();
    });
/* ---------- 7. UUID + QR ---------- */
    const uuid = new URLSearchParams(location.search).get("datos");
    if (!uuid) return;

    fetch(`https://vellum-services.runasp.net/asistencia/qr/${uuid}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(inv => {
            const section = document.getElementById("asistencia");
            
            // Si confirmó que NO asistirá
            if (inv.asistencia === false) {
                section.innerHTML = `
                    <div class="invite-wrapper">
                        <div class="invite-card">
                            <div class="invite-title">Tu Invitación</div>
                            <div style="text-align: center; padding: 40px 20px;">
                                <div style="font-size: 60px; margin-bottom: 20px;">😔</div>
                                <div style="font-size: 24px; color: #666; margin-bottom: 10px;">
                                    Lamentamos que no puedas asistir
                                </div>
                                <div class="guest-name">${inv.nombre}</div>
                                <div style="color: #999; margin-top: 20px;">
                                    Esperamos verte en una próxima ocasión
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }
            // Si ya confirmó que SÍ asistirá o está pendiente
section.innerHTML = `
    <div class="invite-wrapper">
        <div class="invite-card">
            <div class="invite-title">Tu Invitación</div>
            <div class="invite-sub">PRESENTA ESTE CÓDIGO</div>
            <div class="qr-box">
                <div id="qrcode" style="position: relative;"></div>
            </div>
            <div class="guest-name">${inv.nombre}</div>
            <div class="guest-info">
                Confirmación: ${inv.asistencia === true ? "✓ Confirmado" : "Pendiente"}<br>
                Acompañantes: ${inv.invitados} ${inv.invitados === 1 ? 'persona' : 'personas'}
                 <br>
                Mesa: ${inv.mesa || "No asignada"}
            </div>

            ${inv.asistencia !== true ? `
                <!-- Mensaje de periodo finalizado -->
                <div style="margin-top: 20px; padding: 15px; background: #f9f7f4; border: 1px solid #e6dfd8; border-radius: 8px;">
                    <div style="color: #86674a; font-weight: bold; font-size: 15px; margin-bottom: 5px;">
                        El periodo de confirmación ha finalizado
                    </div>
                    <div style="color: #666; font-size: 13px; line-height: 1.4;">
                        Si necesitas realizar algún cambio en tu asistencia, por favor contáctanos directamente.
                    </div>
                </div>
            ` : ''}
        </div>
    </div>
`;
            // Generar QR code
            const qrcodeDiv = document.getElementById("qrcode");
            const qrSize = Math.min(Math.max(Math.floor(window.innerWidth * 0.32), 240), 320);
            
            if (inv.asistencia === true) {
                // QR real con UUID
                new QRCode(qrcodeDiv, {
                    text: uuid,
                    width: qrSize,
                    height: qrSize
                });
            } else {
                // QR estático con signo de interrogación
                new QRCode(qrcodeDiv, {
                    text: "PENDIENTE",
                    width: qrSize,
                    height: qrSize,
                    colorDark: "#cccccc",
                    colorLight: "#ffffff"
                });
                
                // Agregar signo de interrogación en el centro
                setTimeout(() => {
                    const questionMark = document.createElement("div");
                    questionMark.innerHTML = "×";
                    questionMark.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 80px;
                        font-weight: bold;
                        color: #999;
                        background: white;
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    `;
                    qrcodeDiv.appendChild(questionMark);
                }, 100);
            }
/* 
            // Agregar eventos de confirmación DESPUÉS de insertar el HTML
            if (inv.asistencia !== true && inv.asistencia !== false) {
                // Esperar un momento para que el DOM se actualice
                setTimeout(() => {
                    const btnConfirmar = document.getElementById("btnConfirmar");
                    const btnDeclinar = document.getElementById("btnDeclinar");
                    const mensajeConfirmacion = document.getElementById("mensajeConfirmacion");

                    // Función para actualizar asistencia
                    const actualizarAsistencia = (asistira) => {
                        btnConfirmar.disabled = true;
                        btnDeclinar.disabled = true;
                        mensajeConfirmacion.textContent = "Procesando...";
                        mensajeConfirmacion.style.color = "#666";

                        fetch("https://vellum-services.runasp.net/asistencia/actualizar", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                uuid: uuid,
                                asistencia: asistira
                            })
                        })
                        .then(res => res.ok ? res.json() : Promise.reject())
                        .then(() => {
                            if (asistira) {
                                mensajeConfirmacion.style.color = "#4CAF50";
                                mensajeConfirmacion.textContent = "✓ ¡Asistencia confirmada exitosamente!";
                                
                                // Actualizar UI para mostrar QR
                                setTimeout(() => {
                                    location.reload();
                                }, 1500);
                            } else {
                                // Recargar para mostrar mensaje de no asistencia
                                location.reload();
                            }
                        })
                        .catch(() => {
                            mensajeConfirmacion.style.color = "#f44336";
                            mensajeConfirmacion.textContent = "Error al procesar. Intenta de nuevo.";
                            btnConfirmar.disabled = false;
                            btnDeclinar.disabled = false;
                        });
                    };

                    btnConfirmar.addEventListener("click", () => actualizarAsistencia(true));
                    btnDeclinar.addEventListener("click", () => {
                        if (confirm("¿Estás seguro que no podrás asistir?")) {
                            actualizarAsistencia(false);
                        }
                    });
                }, 0);
            }
        })
        .catch(() => {
            document.getElementById("asistencia").innerHTML = `
                <div class="invite-wrapper">
                    <div class="invite-card">
                        <div style="color: #f44336; text-align: center;">
                            Error al cargar la invitación
                        </div>
                    </div>
                </div>
            `;
        }); */
        })
        .catch(() => {
            document.getElementById("asistencia").innerHTML = `
                <div class="invite-wrapper">
                    <div class="invite-card">
                        <div style="color: #f44336; text-align: center;">
                            Error al cargar la invitación. Por favor intenta más tarde.
                        </div>
                    </div>
                </div>
            `;
        });
});