async function searchUsers(query) {
    const usersDiv = document.getElementById("users");

    try {
        const data = await fetchJson(
            `/searchUsersByQuery?data=${encodeURIComponent(
                JSON.stringify({
                    query: query,
                    number: 500,
                })
            )}`
        );

        usersDiv.innerHTML = "";

        data.forEach((element) => {
            const li = document.createElement("li");
            usersDiv.appendChild(li);

            li.textContent = `${element.firstname} ${element.lastname}`;

            const button = document.createElement("button");
            button.className = "watch";
            button.textContent = "voire";

            button.addEventListener("click", () => {
                location.href = `user?id=${element.id}`;
            });

            li.appendChild(button);
        });

    } catch (err) {
        console.error(err);
    }
}

async function SwalFireAddUser() {
    const result = await Swal.fire({
        title: "Ajouter un utilisateur",
        html: `
            <input id="swal-firstname" class="swal2-input" placeholder="Prénom">
            <input id="swal-lastname" class="swal2-input" placeholder="Nom">
            <select id="swal-isadmin" class="swal2-select">
                <option value="0" selected>Utilisateur</option>
                <option value="1">Administrateur</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Ajouter",
        preConfirm: () => {
            const firstname = document.getElementById("swal-firstname").value;
            const lastname = document.getElementById("swal-lastname").value;
            const isadmin = parseInt(
                document.getElementById("swal-isadmin").value
            );

            if (!firstname || !lastname) {
                Swal.showValidationMessage("Prénom et Nom requis");
                return false;
            }

            return { firstname, lastname, isadmin };
        },
    });

    if (!result.isConfirmed) return;

    try {
        const data = await fetchJson("/addUser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result.value),
        });

        console.log("Réponse du serveur :", data);
        location.reload();

    } catch (err) {
        console.error("Erreur fetch :", err);
    }
}
(async () => {
    if (!await isConnected()) {
    location.href = "/";
} else {
    searchUsers("");

    const searchUserInput = document.getElementById("searchUser");
    searchUserInput.addEventListener("input", () => {
        searchUsers(searchUserInput.value);
    });

    const addUserButton = document.getElementById("addUser");
    addUserButton.addEventListener("click", async () => {
        await SwalFireAddUser();
    });
}
})()

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
