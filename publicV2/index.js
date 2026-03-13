let logs = [];

const logsTable = document.getElementById("logsTable");
const noLogsMessage = document.getElementById("noLogsMessage");
const logsBadge = document.getElementById("logsBadge");

function updateLiveTime() {
    const el = document.getElementById("liveTime");
    if (el)
        el.textContent = new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
}
setInterval(updateLiveTime, 1000);
updateLiveTime();

function showTab(tab) {
    document
        .querySelectorAll(".sidebar button")
        .forEach((b) => b.classList.remove("active"));
    if (tab === "logs") {
        document.getElementById("btnLogs").classList.add("active");
        document.getElementById("logs").classList.remove("hidden");
        document.getElementById("admin").classList.add("hidden");
    }
}

async function getAccesslogs() {
    try {
        const data = await fetchJson("/getAccesslogs");
        logs = data;
        displayLogs();
        updateBadges();
    } catch (err) {
        console.error(err);
    }
}

function displayLogs() {
    if (!logsTable) return;
    if (logs.length === 0) {
        logsTable.innerHTML = "";
        noLogsMessage?.classList.remove("hidden");
        return;
    }
    noLogsMessage?.classList.add("hidden");
    logsTable.innerHTML = logs
        .map(
            (l) => `<tr class="success-row"> <!-- Toujours success-row -->
        <td>${escapeHtml(l.lastname || "-")}</td>
        <td>${escapeHtml(l.firstname || "-")}</td>
        <td><code>${escapeHtml(l.rfid || l.uid)}</code></td>
        <td>${escapeHtml(new Date(l.date).toLocaleDateString("fr-FR"))}</td>
        <td>${escapeHtml(new Date(l.date).toLocaleTimeString("fr-FR"))}</td>
        <td><span style="color:var(--success);font-weight:500">
            <i class="fa-solid fa-check-circle"></i> 
            Autorisé
        </span></td>
    </tr>`,
        )
        .join("");
}

function updateBadges() {
    logsBadge && (logsBadge.textContent = logs.length);
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// SSE pour mise à jour en temps réel
let source;

function connectSSE() {
    source = new EventSource("/notifAccesLog");

    source.onmessage = () => {
        getAccesslogs();
    };

    source.onerror = (err) => {
        console.error("Erreur SSE :", err);
        source.close();
        setTimeout(connectSSE, 3000);
    };
}

// Initialisation
(async () => {
    await getAccesslogs();
    connectSSE();
})();
