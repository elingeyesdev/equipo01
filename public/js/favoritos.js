// ============================================================
// FAVORITOS — Optimistic UI + Event Delegation
// ============================================================

document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-favorito');
    if (!btn) return;

    // Evita abrir la card (porque es <a>)
    e.preventDefault();
    e.stopPropagation();

    const icon = btn.querySelector('i');
    const garajeId = btn.dataset.id;

    const usuario = JSON.parse(localStorage.getItem('estairbnb_user'));
    const conductorId = usuario?.id;

    if (!conductorId) {
        mostrarToast("Debes iniciar sesión", true);
        return;
    }

    const esFavorito = icon.classList.contains('fa-solid');

    // 🔥 OPTIMISTIC UI (cambio inmediato)
    icon.classList.toggle('fa-regular');
    icon.classList.toggle('fa-solid');

    try {
        const res = await fetch("/api/favoritos/toggle", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                conductor_id: conductorId,
                garaje_id: garajeId
            })
        });

        const data = await res.json();
        console.log("RESPUESTA BACKEND:", data);

        if (data.status !== "ok") {
            throw new Error("Error backend");
        }

        mostrarToast(
            data.action === "added"
                ? "Guardado en favoritos ❤️"
                : "Eliminado de favoritos 💔"
        );

    } catch (error) {
        console.error("❌ Error en favoritos:", error);

        // 🔁 ROLLBACK (revierte el cambio visual)
        icon.classList.toggle('fa-regular');
        icon.classList.toggle('fa-solid');

        mostrarToast("Error al guardar favorito", true);
    }
});


// ============================================================
// TOAST
// ============================================================

function mostrarToast(mensaje, error = false) {
    const toastEl = document.getElementById("miToast");
    const mensajeEl = document.getElementById("toastMensaje");

    if (!toastEl || !mensajeEl) {
        console.error("❌ Toast no encontrado en HTML");
        return;
    }

    mensajeEl.innerText = mensaje;

    // estilos dinámicos
    toastEl.classList.remove('text-bg-dark', 'text-bg-danger');
    toastEl.classList.add(error ? 'text-bg-danger' : 'text-bg-dark');

    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}