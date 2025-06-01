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

let allMatches = [];
let matchPlayersMap = {}; // matchId → [noms]

socket.emit("get_all_match_players");
socket.on("matches", (matches) => {
  allMatches = matches;
  renderMatches(); // on attend que matchPlayersMap soit rempli aussi
});
socket.on("all_match_players", (data) => {
  matchPlayersMap = data;
  renderMatches(); // une fois qu’on a les joueurs, on peut afficher
});

function renderMatches() {
  const now = Date.now();
  const filtered = allMatches.filter(match => {
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

    const players = matchPlayersMap[match.id] || [];
    if (players.length > 0) {
      const p = document.createElement("div");
      p.className = "match-players";
      p.textContent = `👥 ${players.join(", ")}`;
      li.appendChild(p);
    }

    matchList.appendChild(li);
  });
}
