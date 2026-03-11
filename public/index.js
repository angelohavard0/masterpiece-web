async function getAccesslogs() {
    const logsDiv = document.getElementById("logs");

    try {
        const data = await fetchJson("/getAccesslogs");

        logsDiv.innerHTML = "";

        data.forEach((element) => {
            const li = document.createElement("li");
            logsDiv.appendChild(li);

            li.textContent = `${element.firstname} ${element.lastname} avec le badge "${element.rfid}" le ${formatDateFR(element.date)}`;
        });

    } catch (err) {
        console.error(err);
    }
}

getAccesslogs();



let source;

function connectSSE() {
    source = new EventSource("/notifAccesLog");

    source.onmessage = () => {
        getAccesslogs();
    };

    source.onerror = (err) => {
        console.error("Erreur SSE :", err);
        source.close(); // ferme la connexion actuelle
        // relancer après 3 secondes
        setTimeout(connectSSE, 3000);
    };
}

// lancer la première connexion
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
