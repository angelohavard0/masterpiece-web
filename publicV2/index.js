let logs = [];
let failedLogs = [];
let userStats = { total_users: 0, total_admins: 0 };
let totalBadges = 0;

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

async function getUserStats() {
    try {
        const data = await fetchJson(
            `/getUserStats?data=${encodeURIComponent(JSON.stringify({}))}`,
        );
        if (data && data[0]) {
            userStats = data[0];
            updateStats();
        }
    } catch (err) {
        console.error(err);
    }
}

async function getBadgeStats() {
    try {
        const data = await fetchJson(
            `/getBadgeStats?data=${encodeURIComponent(JSON.stringify({}))}`,
        );
        if (data && data[0]) {
            totalBadges = data[0].total_badges || 0;
            updateStats();
        }
    } catch (err) {
        console.error(err);
    }
}

async function getAccesslogs() {
    try {
        const data = await fetchJson(
            `/getAccesslogs?data=${encodeURIComponent(
                JSON.stringify({ days: 30 }),
            )}`,
        );
        logs = data;
        displayLogs();
        updateStats();
    } catch (err) {
        console.error(err);
    }
}

async function getFailedAccesslogs() {
    try {
        const data = await fetchJson(
            `/getFailedAccesslogs?data=${encodeURIComponent(
                JSON.stringify({ days: 30 }),
            )}`,
        );
        failedLogs = data;
        displayLogs();
        updateStats();
    } catch (err) {
        console.error(err);
        return [];
    }
}

function displayLogs() {
    if (!logsTable) return;

    // Combiner les deux types de logs
    const allLogs = [];

    // Ajouter les logs réussis avec leurs infos
    logs.forEach((l) => {
        allLogs.push({
            firstname: l.firstname || "-",
            lastname: l.lastname || "-",
            rfid: l.rfid,
            date: l.date,
            status: "success",
            log: l.log,
        });
    });

    // Ajouter les logs refusés (sans prénom/nom)
    failedLogs.forEach((l) => {
        allLogs.push({
            firstname: "-",
            lastname: "-",
            rfid: l.rfid,
            date: l.date,
            status: "error",
            log: "Badge inconnu",
        });
    });

    // Trier par date décroissante
    allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allLogs.length === 0) {
        logsTable.innerHTML = "";
        noLogsMessage?.classList.remove("hidden");
        return;
    }

    noLogsMessage?.classList.add("hidden");
    logsTable.innerHTML = allLogs
        .map(
            (
                l,
            ) => `<tr class="${l.status === "success" ? "success-row" : "error-row"}">
        <td>${escapeHtml(l.lastname)}</td>
        <td>${escapeHtml(l.firstname)}</td>
        <td><code>${escapeHtml(l.rfid)}</code></td>
        <td>${escapeHtml(new Date(l.date).toLocaleDateString("fr-FR"))}</td>
        <td>${escapeHtml(new Date(l.date).toLocaleTimeString("fr-FR"))}</td>
        <td><span style="color:${l.status === "success" ? "var(--success)" : "var(--error)"};font-weight:500">
            <i class="fa-solid fa-${l.status === "success" ? "check-circle" : "exclamation-circle"}"></i> 
            ${l.status === "success" ? "Autorisé" : "Refusé"}
        </span></td>
    </tr>`,
        )
        .join("");
}

function updateStats() {
    // Mettre à jour les compteurs dans /index
    const totalUsersEl = document.getElementById("totalUsers");
    const totalLogsEl = document.getElementById("totalLogs");
    const failedLogsEl = document.getElementById("failedLogs");

    if (totalUsersEl) {
        // Total membres = admins + non-admins
        const totalMembers = parseInt(userStats.total_users) || 0;
        totalUsersEl.textContent = totalMembers;
    }

    if (totalLogsEl) {
        totalLogsEl.textContent = logs.length;
    }

    if (failedLogsEl) {
        failedLogsEl.textContent = failedLogs.length;
    }

    // Mettre à jour le badge de la sidebar
    if (logsBadge) {
        logsBadge.textContent = logs.length + failedLogs.length;
    }
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
        getFailedAccesslogs();
    };

    source.onerror = (err) => {
        console.error("Erreur SSE :", err);
        source.close();
        setTimeout(connectSSE, 3000);
    };
}

// Initialisation
(async () => {
    await Promise.all([
        getUserStats(),
        getBadgeStats(),
        getAccesslogs(),
        getFailedAccesslogs(),
    ]);
    connectSSE();
})();
