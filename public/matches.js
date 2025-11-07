const matchList = document.getElementById("match-list");
const params = new URLSearchParams(window.location.search);
const status = params.get("status"); // "ongoing" ou "completed"

const titleMap = {
  ongoing: "Matchs en cours",
  completed: "Résultats",
};

document.getElementById("page-title").textContent = titleMap[status] || "Matchs";

function formatDateTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const dateStr = d.toLocaleDateString('fr-FR', { 
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${dateStr} ${timeStr}`;
}

function calculateScore(sequences) {
  if (!Array.isArray(sequences)) return 0;
  
  let total = 0;
  let currentSection = 0;
  
  sequences.forEach(code => {
    if (typeof code !== 'string') return;
    
    if (code.startsWith("+")) {
      currentSection += parseInt(code.slice(1), 10);
    } else if (code.startsWith("-")) {
      total += currentSection;
      currentSection = 0;
    }
  });
  
  return total + currentSection;
}

function renderMatch(match) {
  const a = document.createElement("a");
  a.href = `match.html?id=${match.id}${status === "completed" ? "&view=readonly" : ""}`;
  a.className = "match-item";

  // En-tête avec la date
  const header = document.createElement("div");
  header.className = "match-header";
  header.innerHTML = `
    <h3>${formatDateTime(match.created_at)}</h3>
    <p>Durée : ${match.duration} min</p>
  `;
  a.appendChild(header);

  // Section des joueurs et scores
  if (status === "completed" && match.sequences) {
    const scoresDiv = document.createElement("div");
    scoresDiv.className = "match-scores";

    // Calculer et trier les scores
    const playerScores = match.players
      .map(player => ({
        player,
        score: calculateScore(match.sequences[player])
      }))
      .sort((a, b) => b.score - a.score);

    // Créer le tableau des scores
    const table = document.createElement("table");
    table.className = "score-table";
    playerScores.forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="rank">${index + 1}</td>
        <td class="player">${entry.player}</td>
        <td class="score">${entry.score} pts</td>
      `;
      table.appendChild(row);
    });

    scoresDiv.appendChild(table);
    a.appendChild(scoresDiv);
  } else {
    // Pour les matches en cours, juste la liste des joueurs
    const players = document.createElement("p");
    players.className = "players-list";
    players.textContent = `Joueurs : ${match.players.join(", ")}`;
    a.appendChild(players);
  }

  return a;
}

async function fetchMatches() {
  try {
    const res = await fetch("/api/matches");
    if (!res.ok) {
      throw new Error(`Erreur ${res.status}`);
    }

    const allMatches = await res.json();
    console.log('Matches reçus:', allMatches); // Debug

    const filtered = allMatches
      .filter((m) => m.status === status)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filtered.length === 0) {
      matchList.innerHTML = "<p>Aucun match à afficher.</p>";
      return;
    }

    matchList.innerHTML = "";
    filtered.forEach(match => {
      matchList.appendChild(renderMatch(match));
    });
  } catch (error) {
    console.error("Erreur lors du chargement des matches:", error);
    matchList.innerHTML = "<p>Erreur lors du chargement des matches.</p>";
  }
}

fetchMatches();
