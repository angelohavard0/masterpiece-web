let users = [];
let userStats = { total_users: 0, total_admins: 0 };
let totalBadges = 0;

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

function updateStats() {
    document.getElementById("totalUsers").textContent =
        userStats.total_users || 0;
    document.getElementById("totalAdmins").textContent =
        userStats.total_admins || 0;
    document.getElementById("totalBadges").textContent = totalBadges;
    document.getElementById("usersBadge").textContent =
        userStats.total_users || 0;
}

async function searchUsers(query) {
    const tbody = document.getElementById("usersTable");
    const noMsg = document.getElementById("noUsersMessage");

    try {
        const data = await fetchJson(
            `/searchUsersByQuery?data=${encodeURIComponent(
                JSON.stringify({
                    query: query,
                    number: 500,
                }),
            )}`,
        );

        users = data;

        if (!users.length) {
            tbody.innerHTML = "";
            noMsg.classList.remove("hidden");
            return;
        }

        noMsg.classList.add("hidden");
        tbody.innerHTML = users
            .map(
                (u) => `<tr>
            <td>${escapeHtml(u.firstname)}</td>
            <td>${escapeHtml(u.lastname)}</td>
            <td>${u.badges?.length || 0} badge(s)</td>
            <td>${
                u.isadmin === 1
                    ? '<span class="status-badge admin"><i class="fa-solid fa-user-tie"></i> Administrateur</span>'
                    : '<span class="status-badge user"><i class="fa-solid fa-user"></i> Membre</span>'
            }
            </td>
            <td>
                <button class="view-btn" onclick="viewUser(${u.id})">
                    <i class="fa-solid fa-eye"></i> Voir plus
                </button>
            </td>
        </tr>`,
            )
            .join("");
    } catch (err) {
        console.error(err);
    }
}

function viewUser(userId) {
    window.location.href = `/admin/user?id=${userId}`;
}

document
    .getElementById("userForm")
    .addEventListener("submit", async function (e) {
        e.preventDefault();

        const firstname = document.getElementById("firstname").value.trim();
        const lastname = document.getElementById("lastname").value.trim();
        const isAdmin = document.getElementById("isAdmin").checked;

        if (!firstname || !lastname) {
            Swal.fire({
                title: "Erreur",
                text: "Le prénom et le nom sont requis",
                icon: "error",
                timer: 2000,
                showConfirmButton: false,
            });
            return;
        }

        try {
            const response = await fetch("/addUser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstname: firstname,
                    lastname: lastname,
                    isadmin: isAdmin ? 1 : 0,
                }),
            });

            if (response.ok) {
                document.getElementById("userForm").reset();
                document.getElementById("isAdmin").checked = false;

                await Promise.all([
                    getUserStats(),
                    getBadgeStats(),
                    searchUsers(document.getElementById("searchUser").value),
                ]);

                Swal.fire({
                    title: "Succès",
                    text: "Utilisateur ajouté avec succès",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                });
            } else {
                throw new Error("Erreur lors de l'ajout");
            }
        } catch (err) {
            console.error("Erreur fetch :", err);
            Swal.fire({
                title: "Erreur",
                text: "Impossible d'ajouter l'utilisateur",
                icon: "error",
                timer: 2000,
                showConfirmButton: false,
            });
        }
    });

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Initialisation avec vérification admin
(async () => {
    if (!(await isConnected())) {
        location.href = "/";
        return;
    }

    await Promise.all([getUserStats(), getBadgeStats(), searchUsers("")]);

    const searchUserInput = document.getElementById("searchUser");
    searchUserInput.addEventListener("input", () => {
        searchUsers(searchUserInput.value);
    });
})();
