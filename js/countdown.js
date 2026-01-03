document.addEventListener("DOMContentLoaded", () => {
  
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


    // ---------- 6. Countdown overlay ----------
    const weddingDate = new Date("2026-04-25T18:00:00");

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

    

});