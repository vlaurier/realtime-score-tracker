const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const statusFilter = urlParams.get("status"); // "active" ou "finished"
const matchList = document.getElementById("matchList");
const emptyMessage = document.getElementById("emptyMessage");
const pageTitle = document.getElementById("pageTitle");

const TITLE_MAP = {
    active: "Rejoindre une Classic Race",
    finished: "Résultats des Classic Races"
};

pageTitle.textContent = TITLE_MAP[statusFilter] || "Liste des Classic Races";

socket.on("matches", (matches) => {
    const now = Date.now();
    const filtered = matches.filter(match => {
        if (statusFilter === "active") {
            return !match.finished;
        } else if (statusFilter === "finished") {
            return match.finished;
        } else {
            return true;
        }
    });

    matchList.innerHTML = "";

    if (filtered.length === 0) {
        emptyMessage.textContent = "Aucun match trouvé.";
        return;
    }

    emptyMessage.textContent = "";

    filtered.forEach(match => {
      const li = document.createElement("li");
      li.className = "match-item";

      const btn = document.createElement("button");
      btn.className = "match-link";
      btn.textContent = match.name;
      btn.onclick = () => {
        window.location.href = `/match.html?id=${match.id}`;
      };

      li.appendChild(btn);
      matchList.appendChild(li);
    });
});
