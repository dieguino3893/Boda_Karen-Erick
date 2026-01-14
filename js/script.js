document.addEventListener("DOMContentLoaded", () => {

    /* ---------- PING BACKEND ---------- */
    fetch("https://netasistencia-bbckcda7hbhpdtgd.eastus-01.azurewebsites.net/asistencia/wakeup")
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

    /* ---------- 2. BOTÓN UBICACIÓN ---------- */
    const button = document.querySelector(".ubication");
    if (button) {
        setInterval(() => {
            button.animate([
                { transform: "scale(1)", backgroundColor: "#B7AA92" },
                { transform: "scale(1.1)", backgroundColor: "#a49780" },
                { transform: "scale(1)", backgroundColor: "#B7AA92" }
            ], { duration: 800 });
        }, 1500);
    }

    /* ---------- 3. MÚSICA ---------- */
    const music = document.getElementById("bg-music");
    if (music) {
        document.addEventListener("click", () => {
            if (music.paused) music.play().catch(() => {});
        }, { once: true });
    }

    /* ---------- 4. COUNTDOWN ---------- */
    const weddingDate = new Date("2025-09-27T19:00:00");

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

    fetch(`https://netasistencia-bbckcda7hbhpdtgd.eastus-01.azurewebsites.net/asistencia/qr/${uuid}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(inv => {
            const section = document.getElementById("asistencia");
            section.innerHTML = `
                <div class="invite-wrapper">
                    <div class="invite-card">
                        <div class="invite-title">Tu Invitación</div>
                        <div class="invite-sub">PRESENTA ESTE CÓDIGO</div>
                        <div class="qr-box">
                            <div id="qrcode"></div>
                        </div>
                        <div class="guest-name">${inv.nombre}</div>
                        <div class="guest-info">
                          Confirmación: ${inv.asistencia ? "✓ Confirmado" : "Pendiente"}<br>
                          Acompañantes: ${inv.invitados} ${inv.invitados === 1 ? 'persona' : 'personas'}
                        </div>
                    </div>
                </div>
            `;

            new QRCode(document.getElementById("qrcode"), {
                text: uuid,
                width: 210,
                height: 210,
                correctLevel: QRCode.CorrectLevel.H
            });
        })
        .catch(() => {
            document.getElementById("asistencia").innerHTML =
                "<p style='text-align:center; color:#B7AA92; font-size:1.2rem; padding:60px 20px;'>Invitación no encontrada</p>";
        });

});