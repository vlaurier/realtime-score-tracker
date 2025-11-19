// Initialiser Socket.IO avec gestion d'erreur et reconnexion
const socket = io({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("Connecté au serveur Socket.IO");
});

socket.on("connect_error", (error) => {
  console.error("Socket.IO connection error:", error);
});

socket.on("disconnect", () => {
  console.log("Déconnecté du serveur Socket.IO");
});

const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get("id");
const isReadOnly = urlParams.get("view") === "readonly";

const titleEl = document.getElementById("page-title");
const chronoEl = document.getElementById("chrono");
const startBtn = document.getElementById("start-btn");
const sequencesContainer = document.getElementById("sequences");
const rankingEl = document.getElementById("ranking");
const saveBtn = document.getElementById("save-btn");

let matchData;
let selectedPlayer = null; // Garde une trace du joueur sélectionné localement
let localSequences = {};
let chronoInterval = null;

// Charger les données initiales du match
async function loadMatchData() {
  try {
    const response = await fetch(`/match/${matchId}`);
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du chargement du match`);
    }
    matchData = await response.json();
    localSequences = JSON.parse(JSON.stringify(matchData.sequences || {}));

    updateTitle();
    renderAllSequences(); // Fonction initiale pour tout construire
    renderRanking();
    updateControls();

    if (matchData.startTimestamp) {
      startBtn.style.display = "none";
      if (!chronoInterval) chronoInterval = setInterval(updateChrono, 1000);
      updateChrono();
    }

    socket.emit("join", matchId);
  } catch (error) {
    console.error("Erreur lors du chargement du match:", error);
    alert("Impossible de charger les données du match. Veuillez rafraîchir la page.");
  }
}

function formatDateTime(isoStr) {
  if (!isoStr) return "Date inconnue";
  const d = new Date(isoStr);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateTitle() {
  const dt = formatDateTime(matchData.created_at || matchData.createdAt);
  titleEl.textContent = `Match du ${dt}`;
}

function calculateScores() {
  return matchData.players.map((player) => {
    const sequences = localSequences[player] || [];
    let total = 0;
    let currentSection = 0;
    let bestStreak = 0;
    let entrySuccesses = 0;
    let entryFailures = 0;

    // Track if we're in a miss section and if it's the first badge
    let isFirstBadge = true;
    let inMissSection = false;
    let missCount = 0;
    let hadSuccessBeforeMiss = false; // Track if the miss section follows a success section

    for (let i = 0; i < sequences.length; i++) {
      const code = sequences[i];

      if (code.startsWith("+")) {
        // Process any pending miss section
        if (inMissSection && missCount > 0) {
          if (isFirstBadge) {
            entryFailures += missCount; // First badge, all count
          } else if (hadSuccessBeforeMiss) {
            entryFailures += Math.max(0, missCount - 1); // Subtract 1 for series-ending miss
          } else {
            entryFailures += missCount; // Consecutive miss sections, all count
          }
          isFirstBadge = false;
          missCount = 0;
          inMissSection = false;
          hadSuccessBeforeMiss = false;
        }

        currentSection += parseInt(code.slice(1), 10);
        if (currentSection > bestStreak) {
          bestStreak = currentSection;
        }
      } else if (code === "-0") {
        // Start or continue miss section
        if (!inMissSection) {
          // Ending a hit section (or starting fresh)
          total += currentSection;
          if (currentSection > 0) {
            entrySuccesses++; // A green badge was created
            hadSuccessBeforeMiss = true; // This miss section follows a success
          } else {
            hadSuccessBeforeMiss = false; // No success before this miss section
          }
          currentSection = 0;
          inMissSection = true;
        }
        missCount++;
      }
    }

    // Process any remaining miss section
    if (inMissSection && missCount > 0) {
      if (isFirstBadge) {
        entryFailures += missCount;
      } else if (hadSuccessBeforeMiss) {
        entryFailures += Math.max(0, missCount - 1);
      } else {
        entryFailures += missCount;
      }
    }

    total += currentSection;
    if (currentSection > bestStreak) {
      bestStreak = currentSection;
    }
    if (currentSection > 0) {
      entrySuccesses++; // Count the current ongoing series
    }

    return { player, score: total, bestStreak, entrySuccesses, entryFailures };
  });
}

function updateControls() {
  const hasStarted = !!matchData.startTimestamp;
  startBtn.style.display = hasStarted ? "none" : "block";

  document.querySelectorAll(".sequence-block").forEach((block) => {
    const player = block.dataset.player;
    const isActive = player === selectedPlayer;
    const actionButtons = block.querySelector(".player-actions");

    if (isActive && hasStarted && !isReadOnly) {
      block.classList.add("active");
      block.classList.remove("inactive");
      if (actionButtons) actionButtons.style.display = "flex";
    } else {
      block.classList.remove("active");
      block.classList.add("inactive");
      if (actionButtons) actionButtons.style.display = "none";
    }
  });
}

function updateChrono() {
  if (!matchData.startTimestamp) return;

  const start = new Date(matchData.startTimestamp);
  const now = new Date();
  const elapsed = Math.floor((now - start) / 1000);
  const remaining = matchData.duration * 60 - elapsed;

  if (saveBtn) {
    saveBtn.disabled = remaining > 0;
    saveBtn.classList.toggle("disabled", remaining > 0);
  }

  if (remaining <= 0) {
    chronoEl.textContent = "Match terminé";
    if (chronoInterval) {
      clearInterval(chronoInterval);
      chronoInterval = null;
    }
    return;
  }

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  chronoEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
}

// Met à jour uniquement la visualisation de la séquence d'un joueur
function updatePlayerSequence(player) {
  const block = sequencesContainer.querySelector(`.sequence-block[data-player="${player}"]`);
  if (!block) return;

  const sequenceZone = block.querySelector(".sequence");
  if (!sequenceZone) return;

  sequenceZone.innerHTML = ""; // On vide juste la zone de séquence
  const seq = localSequences[player] || [];

  let sections = [];
  let current = [];
  let currentType = null;

  seq.forEach(code => {
    const type = code.startsWith("+") ? "hit" : "miss";
    const value = type === "hit" ? parseInt(code.slice(1), 10) : 1;

    if (currentType !== type && current.length > 0) {
      sections.push({ type: currentType, count: current.reduce((a, b) => a + b, 0) });
      current = [];
    }
    currentType = type;
    current.push(value);
  });

  if (current.length > 0) {
    sections.push({ type: currentType, count: current.reduce((a, b) => a + b, 0) });
  }

  sections.forEach(section => {
    const span = document.createElement("span");
    span.className = section.type;
    span.textContent = String(section.count);
    sequenceZone.appendChild(span);
  });
}

// Construit l'intégralité des blocs de joueurs (appelé une seule fois)
function renderAllSequences() {
  sequencesContainer.innerHTML = "";

  matchData.players.forEach((player) => {
    const block = document.createElement("div");
    block.className = "sequence-block";
    block.dataset.player = player;

    // La sélection se fait sur tout le bloc
    block.onclick = () => {
      if (matchData.status !== 'completed' && !isReadOnly) {
        selectedPlayer = player;
        updateControls();
      }
    };

    const mainInfo = document.createElement("div");
    mainInfo.className = "main-info";

    const name = document.createElement("h3");
    name.textContent = player;
    mainInfo.appendChild(name);

    const sequenceZone = document.createElement("div");
    sequenceZone.className = "sequence";
    mainInfo.appendChild(sequenceZone);
    block.appendChild(mainInfo);

    // Boutons d'action par joueur
    const actions = document.createElement("div");
    actions.className = "player-actions";
    actions.style.display = "none";

    const hitBtn = document.createElement("button");
    hitBtn.textContent = "✅";
    hitBtn.className = "success-btn small-btn";
    hitBtn.onclick = (e) => { e.stopPropagation(); pushSequence(player, "hit"); };
    actions.appendChild(hitBtn);

    const missBtn = document.createElement("button");
    missBtn.textContent = "❌";
    missBtn.className = "error-btn small-btn";
    missBtn.onclick = (e) => { e.stopPropagation(); pushSequence(player, "miss"); };
    actions.appendChild(missBtn);

    const undoBtn = document.createElement("button");
    undoBtn.textContent = "↩️";
    undoBtn.className = "secondary-btn small-btn";
    undoBtn.onclick = (e) => { e.stopPropagation(); undoLast(player); };
    actions.appendChild(undoBtn);

    block.appendChild(actions);
    sequencesContainer.appendChild(block);

    // Rendu initial de la séquence
    updatePlayerSequence(player);
  });

  updateControls();
}

function renderRanking() {
  const scores = calculateScores();
  scores.sort((a, b) => b.score - a.score);

  rankingEl.innerHTML = "";

  // Create table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th class="rank-col">#</th>
    <th class="player-col">Joueur</th>
    <th class="score-col">Pts</th>
    <th class="streak-col">Série</th>
    <th class="entry-col">Entrée</th>
  `;
  thead.appendChild(headerRow);
  rankingEl.appendChild(thead);

  // Create table body
  const tbody = document.createElement("tbody");
  scores.forEach((entry, i) => {
    const row = document.createElement("tr");
    if (i === 0) row.classList.add("first-place");

    // Calculate entry point display
    const totalEntries = entry.entrySuccesses + entry.entryFailures;
    let entryDisplay = "-";
    if (totalEntries > 0) {
      const percentage = Math.round((entry.entrySuccesses / totalEntries) * 100);
      entryDisplay = `${entry.entrySuccesses}/${totalEntries} ${percentage}%`;
    }

    row.innerHTML = `
      <td class="rank-col">${i + 1}</td>
      <td class="player-col">${entry.player}</td>
      <td class="score-col">${entry.score}</td>
      <td class="streak-col">${entry.bestStreak}</td>
      <td class="entry-col">${entryDisplay}</td>
    `;
    tbody.appendChild(row);
  });
  rankingEl.appendChild(tbody);
}

async function pushSequence(player, type) {
  if (!player) return;

  if (!localSequences[player]) localSequences[player] = [];

  const sequence = localSequences[player];
  const last = sequence[sequence.length - 1];

  if (type === "hit") {
    if (last && last.startsWith("+")) {
      const count = parseInt(last.slice(1)) + 1;
      sequence[sequence.length - 1] = `+${count}`;
    } else {
      sequence.push("+1");
    }
  } else { // miss
    sequence.push("-0");
  }

  updatePlayerSequence(player);
  renderRanking();
  emitUpdate();
  await saveMatch();
}

async function undoLast(player) {
  if (!player) return;
  const seq = localSequences[player];
  if (seq && seq.length > 0) {
    const last = seq[seq.length - 1];
    if (last.startsWith("+")) {
      const count = parseInt(last.slice(1));
      if (count > 1) {
        seq[seq.length - 1] = `+${count - 1}`;
      } else {
        seq.pop();
      }
    } else {
      seq.pop();
    }
    emitUpdate();
    updatePlayerSequence(player);
    renderRanking();
    await saveMatch();
  }
}

function emitUpdate(type = "sequences") {
  let updateData = { matchId, type, timestamp: new Date().toISOString() };

  switch (type) {
    case "sequences":
      updateData.sequences = localSequences;
      break;
    case "start":
      updateData.startTimestamp = matchData.startTimestamp;
      break;
    case "complete":
      updateData.status = "completed";
      updateData.sequences = localSequences;
      break;
  }
  socket.emit("update", updateData);
}

function applyUpdate(data) {
  if (!data) return;

  switch (data.type) {
    case "sequences":
      if (data.sequences) {
        localSequences = data.sequences;
        matchData.players.forEach(player => updatePlayerSequence(player));
        renderRanking();
      }
      break;
    case "start":
      if (data.startTimestamp) {
        matchData.startTimestamp = data.startTimestamp;
        matchData.status = "ongoing";
        if (!chronoInterval) chronoInterval = setInterval(updateChrono, 1000);
        updateControls();
        updateChrono();
      }
      break;
    case "complete":
      if (data.status === "completed") {
        matchData.status = "completed";
        localSequences = data.sequences || {};
        if (chronoInterval) clearInterval(chronoInterval);
        location.reload();
      }
      break;
  }
}

async function startMatch() {
  try {
    matchData.startTimestamp = new Date().toISOString();
    await saveMatch();
    emitUpdate("start");
    updateControls();
    if (!chronoInterval) chronoInterval = setInterval(updateChrono, 1000);
  } catch (error) {
    alert("Erreur lors du démarrage du match.");
    console.error("Start match error:", error);
  }
}

async function saveMatch() {
  try {
    const dataToSave = { ...matchData, sequences: localSequences };
    const response = await fetch(`/match/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSave),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (result.status === "completed") location.reload();
    return result;
  } catch (error) {
    console.error("Error saving match:", error);
    throw error;
  }
}

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  loadMatchData();

  startBtn.onclick = startMatch;
  saveBtn.onclick = async () => {
    if (!saveBtn.disabled && confirm("Confirmez-vous la sauvegarde du match ? Aucune rectification ne sera possible après.")) {
      try {
        document.querySelectorAll('.player-actions').forEach(el => el.style.display = 'none');
        saveBtn.style.display = "none";
        matchData.status = "completed";
        await saveMatch();
        emitUpdate("complete");
      } catch (error) {
        alert("Une erreur est survenue lors de la sauvegarde du match");
      }
    }
  };

  socket.on("update", applyUpdate);
});
