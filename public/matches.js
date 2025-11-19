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
  if (!Array.isArray(sequences)) return { score: 0, bestStreak: 0, entrySuccesses: 0, entryFailures: 0 };

  let total = 0;
  let currentSection = 0;
  let bestStreak = 0;
  let entrySuccesses = 0;
  let entryFailures = 0;

  // Track if we're in a miss section and if it's the first badge
  let isFirstBadge = true;
  let inMissSection = false;
  let missCount = 0;

  sequences.forEach(code => {
    if (typeof code !== 'string') return;

    if (code.startsWith("+")) {
      // Process any pending miss section
      if (inMissSection && missCount > 0) {
        if (isFirstBadge) {
          entryFailures += missCount; // First badge, all count
        } else {
          entryFailures += Math.max(0, missCount - 1); // Subtract 1 for series-ending miss
        }
        isFirstBadge = false;
        missCount = 0;
        inMissSection = false;
      }

      currentSection += parseInt(code.slice(1), 10);
      if (currentSection > bestStreak) {
        bestStreak = currentSection;
      }
    } else if (code.startsWith("-")) {
      // Start or continue miss section
      if (!inMissSection) {
        // Ending a hit section (or starting fresh)
        total += currentSection;
        if (currentSection > 0) {
          entrySuccesses++; // A green badge was created
        }
        currentSection = 0;
        inMissSection = true;
      }
      missCount++;
    }
  });

  // Process any remaining miss section
  if (inMissSection && missCount > 0) {
    if (isFirstBadge) {
      entryFailures += missCount;
    } else {
      entryFailures += Math.max(0, missCount - 1);
    }
  }

  total += currentSection;
  if (currentSection > bestStreak) {
    bestStreak = currentSection;
  }
  if (currentSection > 0) {
    entrySuccesses++; // Count the current ongoing series
  }

  return { score: total, bestStreak, entrySuccesses, entryFailures };
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
      .map(player => {
        const result = calculateScore(match.sequences[player]);
        return {
          player,
          score: result.score,
          bestStreak: result.bestStreak,
          entrySuccesses: result.entrySuccesses,
          entryFailures: result.entryFailures
        };
      })
      .sort((a, b) => b.score - a.score);

    // Créer le tableau des scores
    const table = document.createElement("table");
    table.className = "score-table";

    // Add header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `
      <th class="rank">#</th>
      <th class="player">Joueur</th>
      <th class="score">Pts</th>
      <th class="streak">Série</th>
      <th class="entry">Entrée</th>
    `;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Add body
    const tbody = document.createElement("tbody");
    playerScores.forEach((entry, index) => {
      // Calculate entry point display
      const totalEntries = entry.entrySuccesses + entry.entryFailures;
      let entryDisplay = "-";
      if (totalEntries > 0) {
        const percentage = Math.round((entry.entrySuccesses / totalEntries) * 100);
        entryDisplay = `${entry.entrySuccesses}/${totalEntries} ${percentage}%`;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="rank">${index + 1}</td>
        <td class="player">${entry.player}</td>
        <td class="score">${entry.score} pts</td>
        <td class="streak">${entry.bestStreak}</td>
        <td class="entry">${entryDisplay}</td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

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
