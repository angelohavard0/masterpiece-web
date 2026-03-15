let currentUser = null;
let userBadges = [];
let scanSource = null;
const params = new URLSearchParams(location.search);

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

async function loadUser() {
    try {
        const data = await fetchJson(
            `/getUserById?data=${encodeURIComponent(
                JSON.stringify({ id: params.get("id") }),
            )}`,
        );

        currentUser = data[0];

        const adminBadge =
            currentUser.isadmin === 1
                ? ' <span class="status-badge admin" style="margin-left:10px"><i class="fa-solid fa-user-tie"></i> Administrateur</span>'
                : "";
        document.getElementById("userFullName").innerHTML =
            `${escapeHtml(currentUser.firstname)} ${escapeHtml(currentUser.lastname)}${adminBadge}`;
    } catch (err) {
        console.error(err);
    }
}

async function loadBadges() {
    const badgesDiv = document.getElementById("badgeList");

    try {
        const data = await fetchJson(
            `/getBadgesByUser_id?data=${encodeURIComponent(
                JSON.stringify({ user_id: params.get("id") }),
            )}`,
        );

        userBadges = data;

        if (!data.length) {
            badgesDiv.innerHTML =
                '<div class="info-message"><i class="fa-solid fa-id-card"></i> Aucun badge associé</div>';
            return;
        }

        badgesDiv.innerHTML = data
            .map((b) => {
                return `<div class="badge-item">
                <div class="badge-header"><i class="fa-solid fa-id-card"></i><span>Badge</span></div>
                <div class="badge-uid">${escapeHtml(b.rfid)}</div>
                <div class="badge-actions">
                    <button class="badge-btn delete" onclick="deleteBadge(${b.id}, '${b.rfid}')">
                        <i class="fa-solid fa-trash"></i> Supprimer
                    </button>
                </div>
            </div>`;
            })
            .join("");
    } catch (err) {
        console.error(err);
    }
}

async function loadLogs() {
    const tbody = document.getElementById('logsTable');

    try {
        const data = await fetchJson(
            `/getAccesslogsByUser_id?data=${encodeURIComponent(
                JSON.stringify({
                    id: params.get("id"),
                    days: 30 // Toujours 30 jours
                })
            )}`
        );

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Aucun passage</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(l => `<tr class="success-row">
            <td><code>${escapeHtml(l.rfid)}</code></td>
            <td>${escapeHtml(new Date(l.date).toLocaleDateString('fr-FR'))}</td>
            <td>${escapeHtml(new Date(l.date).toLocaleTimeString('fr-FR'))}</td>
            <td><span style="color:var(--success)">
                <i class="fa-solid fa-check-circle"></i> 
                Autorisé
            </span></td>
        </tr>`).join('');

    } catch (err) {
        console.error(err);
    }
}

async function deleteBadge(badgeId, rfid) {
    const result = await Swal.fire({
        title: `Supprimer le badge ${rfid} ?`,
        showCancelButton: true,
        confirmButtonText: "Supprimer",
        cancelButtonText: "Annuler",
        confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    try {
        const res = await fetch(
            `/deleteBadgesById?data=${encodeURIComponent(
                JSON.stringify({ id: badgeId }),
            )}`,
            { method: "DELETE" },
        );

        if (res.ok) {
            loadBadges();
            Swal.fire({
                title: "Badge supprimé",
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// Interface de scan
function startScan() {
    if (scanSource) {
        scanSource.close();
    }

    document.getElementById("scanButton").classList.add("hidden");
    document.getElementById("cancelScanButton").classList.remove("hidden");
    document.getElementById("scanResult").classList.remove("hidden");
    document.getElementById("scannedBadgeUid").value = "";

    scanSource = new EventSource("/getScannerRfid");

    scanSource.onmessage = (event) => {
        try {
            const rfid = JSON.parse(event.data);
            console.log("Badge scanné:", rfid);
            document.getElementById("scannedBadgeUid").value = rfid;
            scanSource.close();
            scanSource = null;
        } catch (err) {
            console.error("Erreur parsing RFID:", err);
        }
    };

    scanSource.onerror = (err) => {
        console.error("Erreur SSE scan:", err);
        scanSource.close();
        scanSource = null;
        cancelScan();

        Swal.fire({
            title: "Erreur de scan",
            text: "Problème de connexion avec le scanner",
            icon: "error",
            timer: 2000,
            showConfirmButton: false,
        });
    };
}

function cancelScan() {
    if (scanSource) {
        scanSource.close();
        scanSource = null;
    }

    document.getElementById("scanButton").classList.remove("hidden");
    document.getElementById("cancelScanButton").classList.add("hidden");
    document.getElementById("scanResult").classList.add("hidden");
    document.getElementById("scannedBadgeUid").value = "";

    console.log("Scan annulé");
}

async function addScannedBadge() {
    const uid = document.getElementById("scannedBadgeUid").value.trim();
    if (!uid || !currentUser) {
        Swal.fire({
            title: "Erreur",
            text: "Aucun badge scanné",
            icon: "error",
            timer: 1500,
            showConfirmButton: false,
        });
        return;
    }

    if (userBadges.some((b) => b.rfid === uid)) {
        Swal.fire({
            title: "Badge déjà existant",
            text: "Ce badge est déjà associé à cet utilisateur",
            icon: "warning",
            timer: 2000,
            showConfirmButton: false,
        });
        return;
    }

    const confirm = await Swal.fire({
        title: `Ajouter le badge ${uid} ?`,
        text: `À ${currentUser.firstname} ${currentUser.lastname}`,
        showCancelButton: true,
        confirmButtonText: "Ajouter",
        cancelButtonText: "Annuler",
    });

    if (!confirm.isConfirmed) return;

    try {
        const res = await fetch("/addBadgesByUser_idAndRfid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: currentUser.id,
                rfid: uid,
            }),
        });

        if (res.ok) {
            cancelScan();
            await loadBadges();
            Swal.fire({
                title: "Badge ajouté",
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
            });
        } else {
            const error = await res.text();
            throw new Error(error || "Erreur lors de l'ajout");
        }
    } catch (err) {
        console.error("Erreur ajout badge:", err);
        Swal.fire({
            title: "Erreur",
            text: err.message || "Impossible d'ajouter le badge",
            icon: "error",
            timer: 2000,
            showConfirmButton: false,
        });
    }
}

document
    .getElementById("deleteUser")
    ?.addEventListener("click", async function () {
        if (!currentUser) return;

        const result = await Swal.fire({
            title: `Supprimer l'utilisateur ${currentUser.firstname} ${currentUser.lastname} ?`,
            text: "Cette action est irréversible",
            showCancelButton: true,
            confirmButtonText: "Supprimer",
            cancelButtonText: "Annuler",
            confirmButtonColor: "#dc2626",
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch(
                `/deleteUsersById?data=${encodeURIComponent(
                    JSON.stringify({ id: currentUser.id }),
                )}`,
                { method: "DELETE" },
            );

            if (res.ok) location.href = "/admin";
        } catch (err) {
            console.error(err);
        }
    });

// SSE pour mise à jour en temps réel des logs
let logsSource;

function connectLogsSSE() {
    logsSource = new EventSource("/notifAccesLog");

    logsSource.onmessage = () => {
        loadLogs();
    };

    logsSource.onerror = (err) => {
        console.error("Erreur SSE logs:", err);
        logsSource.close();
        setTimeout(connectLogsSSE, 3000);
    };
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener("beforeunload", function () {
    if (scanSource) {
        scanSource.close();
    }
    if (logsSource) {
        logsSource.close();
    }
});

(async () => {
    if (!(await isConnected())) {
        location.href = "/";
        return;
    }

    await loadUser();
    await loadBadges();
    await loadLogs();
    connectLogsSSE();
})();
