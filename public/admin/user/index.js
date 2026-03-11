const params = new URLSearchParams(location.search);

async function loadUser(params) {
    const titleOfUser = document.getElementById("titleOfUser");
    const isAdminDiv = document.getElementById("isAdmin");

    try {
        const data = await fetchJson(
            `/getUserById?data=${encodeURIComponent(
                JSON.stringify({ id: params.get("id") }),
            )}`,
        );

        const user = data[0];

        titleOfUser.textContent = `${user.firstname} ${user.lastname}`;
        isAdminDiv.textContent =
            user.isadmin === 1 ? "sait utilisateur est administrateur !" : "";

        setupAddBadgeButton(user);
        setupDeleteUserButton(user);
    } catch (err) {
        console.error(err);
    }
}

async function loadBadges(params) {
    const badgesDiv = document.getElementById("badges");

    try {
        const data = await fetchJson(
            `/getBadgesByUser_id?data=${encodeURIComponent(
                JSON.stringify({ user_id: params.get("id") }),
            )}`,
        );

        badgesDiv.innerHTML = "";

        data.forEach(createBadgeElement);
    } catch (err) {
        console.error(err);
    }
}

function createBadgeElement(element) {
    const badgesDiv = document.getElementById("badges");

    const li = document.createElement("li");
    li.textContent = element.rfid;

    const button = document.createElement("button");
    button.textContent = "suprimé";
    button.className = "delete";
    button.addEventListener("click", () => deleteBadge(element));

    li.appendChild(button);
    badgesDiv.appendChild(li);
}

async function deleteBadge(element) {
    const result = await Swal.fire({
        title: `veut tu vraiment suprimé le badge ${element.rfid} ?`,
        showCancelButton: true,
        confirmButtonText: "suprimé",
        cancelButtonText: "anullé",
    });

    if (!result.isConfirmed) return;

    const res = await fetch(
        `/deleteBadgesById?data=${encodeURIComponent(
            JSON.stringify({ id: element.id }),
        )}`,
        { method: "DELETE" },
    );

    if (res.ok) location.reload();
}

async function loadLogs(params) {
    const logsDiv = document.getElementById("logs");

    try {
        const data = await fetchJson(
            `/getAccesslogsByUser_id?data=${encodeURIComponent(
                JSON.stringify({
                    id: params.get("id"),
                    number: 500,
                }),
            )}`,
        );

        logsDiv.innerHTML = "";

        data.forEach((element) => {
            const li = document.createElement("li");
            li.textContent = `avec le badge ${element.rfid} le ${formatDateFR(element.date)}`;
            logsDiv.appendChild(li);
        });
    } catch (err) {
        console.error(err);
    }
}

function setupAddBadgeButton(user) {
    const button = document.getElementById("addBadge");
    button.addEventListener("click", () => addBadge(user));
}

async function addBadge(user) {
    const scan = await Swal.fire({
        title: "veillé scanné le badge",
        showCancelButton: true,
        confirmButtonText: "scanné",
        cancelButtonText: "anullé",
    });

    if (!scan.isConfirmed) return;

    const rfid = await getScannerRfid();

    const confirm = await Swal.fire({
        title: `vous voulé ajouté le badge ${rfid} a ${user.firstname} ${user.lastname}`,
        showCancelButton: true,
        confirmButtonText: "ajouté",
        cancelButtonText: "anullé",
    });

    if (!confirm.isConfirmed) return;

    const res = await fetch("/addBadgesByUser_idAndRfid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: user.id,
            rfid: rfid,
        }),
    });

    if (res.ok) location.reload();
    else {
        Swal.fire({
            title: "une erreur est survenu ! le badge n'a probablement pas étais ajouté !!!",
        });
    }
}

function setupDeleteUserButton(user) {
    const button = document.getElementById("deleteUser");
    button.addEventListener("click", () => deleteUser(user));
}

async function deleteUser(user) {
    const result = await Swal.fire({
        title: `vous voulé suprimé l'utilisateur ${user.firstname} ${user.lastname} ?`,
        showCancelButton: true,
        confirmButtonText: "suprimé",
        cancelButtonText: "anullé",
    });

    if (!result.isConfirmed) return;

    const res = await fetch(
        `/deleteUsersById?data=${encodeURIComponent(
            JSON.stringify({ id: user.id }),
        )}`,
        { method: "DELETE" },
    );

    if (res.ok) location.href = "/admin";
}

async function initUserPage() {
    await loadUser(params);
    await loadBadges(params);
    await loadLogs(params);
}

(async () => {
    if (await !isConnected()) {
        location.href = "/";
    } else {
        initUserPage();
    }
})();

let source;

function connectSSE() {
    source = new EventSource("/notifAccesLog");

    source.onmessage = () => {
        loadLogs(params);
    };

    source.onerror = (err) => {
        console.error("Erreur SSE :", err);
        source.close();
        setTimeout(connectSSE, 3000);
    };
}

connectSSE();

const openAdminInterfaceButton = document.getElementById("openAdminInterface");
openAdminInterfaceButton.addEventListener("click", async () => {
    if (await isConnected()) {
        location.href = "/admin";
    } else {
        Swal.fire({
            title: "vous devé scanné un badge administrateur sur a arduino administrateur pour activé l'interface !!!",
        });
    }
});
