function importScript(src) {
    const script = document.createElement("script");
    script.src = src;
    document.head.appendChild(script);
}

importScript("/lib/sweetalert2.all.min.js");

async function isConnected() {
    try {
        const res = await fetch("/isConnected");
        const data = await res.json();
        return data.value; // true ou false
    } catch (err) {
        console.error("Erreur :", err);
        return false;
    }
}

function getScannerRfid() {
    return new Promise((resolve, reject) => {
        const source = new EventSource("/getScannerRfid");

        source.onmessage = (event) => {
            const data = JSON.parse(event.data); // string RFID

            source.close();

            resolve(data); // retourne la chaine
        };

        source.onerror = (err) => {
            console.error("Erreur SSE :", err);
            source.close();

            reject(err);
        };
    });
}

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    return res.json();
}

function formatDateFR(dateStr) {
    let date = new Date(dateStr);
    // Ajouter 1 heure
    date.setHours(date.getHours() + 1);

    // Options pour le format français
    let options = { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    };

    return date.toLocaleString('fr-FR', options);
}