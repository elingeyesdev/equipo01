(async function () {

    const usuario = JSON.parse(localStorage.getItem('estairbnb_user'));
    if (!usuario) return;

    const conductorId = usuario.id;
    const grid = document.getElementById('favoritosGrid');
    const empty = document.getElementById('emptyFavoritos');

    try {
        // 1. Obtener favoritos
        const res = await fetch(`/api/favoritos?conductor_id=${conductorId}`);
        const json = await res.json();

        if (json.status !== 'ok') return;

        const favoritos = json.data;

        // 🔴 EMPTY STATE
        if (!favoritos || favoritos.length === 0) {
            empty.classList.remove('d-none');
            return;
        }

        // 2. Recorrer favoritos
        for (const g of favoritos) {

            let libres = 0;

            // 🧠 CONSULTA ESPACIOS (con protección)
            try {
                const espaciosRes = await fetch(`/api/garajes/${g.id}/espacios`);
                const espaciosJson = await espaciosRes.json();

                if (espaciosJson.status === 'ok') {
                    libres = espaciosJson.data.filter(e => e.estado === 'libre').length;
                }
            } catch (e) {
                console.error("Error cargando espacios", e);
            }

            // 🧠 TEXTO INTELIGENTE
            const badgeText =
                libres === 0
                    ? 'Lleno'
                    : libres === 1
                        ? '1 espacio libre'
                        : `${libres} espacios libres`;

            // 🎨 COLOR DEL BADGE
            const badge = libres > 0
                ? `<span class="badge bg-success">${badgeText}</span>`
                : `<span class="badge bg-danger">${badgeText}</span>`;

            // 🖼️ IMAGEN (si existe)
            const img = g.foto_principal
                ? `<img src="${g.foto_principal}" class="card-img-top" style="height:180px;object-fit:cover;">`
                : '';

            // 📦 CARD
            const card = document.createElement('div');
            card.className = "w-full max-w-md";

            card.innerHTML = `
    <div class="bg-white rounded-xl shadow-md overflow-hidden w-full hover:shadow-lg transition">

        ${g.foto_principal ? `
            <img src="${g.foto_principal}" 
                 class="w-full h-48 object-cover">
        ` : `
            <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
                <span class="text-gray-400">Sin imagen</span>
            </div>
        `}

        <div class="p-4">
            <h3 class="font-semibold text-lg text-gray-800 mb-1">
                ${g.direccion}
            </h3>

            <p class="text-gray-600 mb-2">
                Bs. ${g.precio_hora}/hora
            </p>

            ${badge}
        </div>
    </div>
`;

            // 👉 CLICK PARA IR AL DETALLE
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                window.location.href = `/detalle-garaje.html?id=${g.id}`;
            });

            grid.appendChild(card);
        }

    } catch (err) {
        console.error("Error:", err);
    }

})();