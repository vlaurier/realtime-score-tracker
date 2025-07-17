// match.js
const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get("id");
const initialPlayer = urlParams.get("player") || null;

let matchStartedAt = null;
let matchDuration = null;
let countdownInterval = null;
let matchFinished = false;
let players = [];
let activePlayerId = null; // Aucun joueur sélectionné par défaut
let numberBuffer = "";
let bufferTimer = null;
const playerSequences = {}; // { playerId: [✅✅❌] }

// DOM elements
const playerButtonsDiv = document.getElementById("playerButtons");
const sequenceArea = document.getElementById("sequenceArea");
const statusContainer = document.getElementById("statusContainer");
const scoreTable = document.getElementById("scoreTable");
const failButton = document.getElementById("failButton");
const notification = document.getElementById("notification");
const matchTitle = document.getElementById("matchTitle");
const successActionBtn = document.getElementById("successAction");
const failActionBtn = document.getElementById("failAction");
const actionButtonsDiv = document.getElementById("actionButtons");

// 👉 Main animée
const hintHand = document.createElement("div");
hintHand.innerHTML = "👉";
hintHand.className = "hint-hand";
hintHand.id = "hintHand";

// Initial socket fetch
socket.emit("get_match_info", matchId);
socket.emit("get_match_players", matchId);
socket.emit("get_player_sequences", matchId);
socket.emit("join_match", matchId);

// Events
socket.on("match_info", (match) => {
  matchDuration = match.duration;
  if (match.name) matchTitle.textContent = match.name;

  if (match.started && match.startedAt) {
    matchStartedAt = match.startedAt;
    startCountdown();
  } else {
    renderCountdown(match.duration * 60 * 1000);
  }
  renderPlayerButtons(); // important pour afficher main ou pas
});

socket.on("match_players", ({ matchId: id, players: p }) => {
  if (id !== matchId) return;
  players = p;
  renderPlayerButtons();
});

socket.on("match_players_updated", ({ matchId: id, players: p }) => {
  if (id !== matchId) return;
  players = p.map(name => ({ id: name, name }));
  renderPlayerButtons();
});

socket.on("match_started", ({ matchId: id, startedAt }) => {
  if (id !== matchId) return;
  matchStartedAt = startedAt;
  renderPlayerButtons(); // important pour cacher main
  startCountdown();
});

socket.on("match_finalized", ({ matchId: id }) => {
  if (id !== matchId) return;
  matchFinished = true;
});

socket.on("player_sequences", ({ matchId: id, sequences }) => {
  if (id !== matchId) return;
  Object.entries(sequences).forEach(([pid, seq]) => playerSequences[pid] = [...seq]);
  renderSequence();
});

socket.on("score_update", ({ matchId: id, scores }) => {
  if (id !== matchId) return;
  renderScoreboard(scores);
});

function renderPlayerButtons() {
  playerButtonsDiv.innerHTML = "";
  players.sort((a, b) => a.name.localeCompare(b.name));

  players.forEach(player => {
    const btn = document.createElement("button");
    btn.textContent = player.name;
    btn.className = "player-button";
    if (player.id === activePlayerId) btn.classList.add("active");
    btn.onclick = () => {
      activePlayerId = player.id;
      renderPlayerButtons();
      renderSequence();
    };
    playerButtonsDiv.appendChild(btn);
  });

  // 👉 Ajoute la main uniquement si aucun joueur sélectionné et match non démarré
  const shouldShowHand = !activePlayerId && !matchStartedAt;
  if (shouldShowHand) {
    playerButtonsDiv.prepend(hintHand);
  }

  // 🔘 Afficher ou cacher les boutons "Réussi" / "Manqué"
  const showActions = !!activePlayerId && !!matchStartedAt && !matchFinished;
  actionButtonsDiv.style.display = showActions ? "flex" : "none";

}

function renderSequence() {
  sequenceArea.innerHTML = "";
  if (!activePlayerId) return;

  const seq = playerSequences[activePlayerId] || [];
  const container = document.createElement("div");
  container.className = "sequence-container";

  let streak = 0;
  seq.forEach(mark => {
    if (mark === "✅") {
      streak++;
    } else {
      if (streak > 0) {
        const s = document.createElement("div");
        s.textContent = streak;
        s.className = "sequence-item success";
        container.appendChild(s);
        streak = 0;
      }
      if (mark === "❌") {
        const fail = document.createElement("div");
        fail.textContent = "❌";
        fail.className = "sequence-item fail";
        container.appendChild(fail);
      }
    }
  });

  // Ajoute la dernière série de réussites si elle existe
  if (streak > 0) {
    const s = document.createElement("div");
    s.textContent = streak;
    s.className = "sequence-item success";
    container.appendChild(s);
  }

  // Bouton temporaire pour nombre en cours (inutile ici mais conservé pour transition propre si besoin)
  if (numberBuffer) {
    const tmp = document.createElement("div");
    tmp.textContent = numberBuffer;
    tmp.className = "sequence-item temp";
    container.appendChild(tmp);
  }

  // Bouton de correction ↩
  if (matchStartedAt && seq.length > 0) {
    const undo = document.createElement("button");
    undo.textContent = "↩";
    undo.className = "sequence-correct-button";
    undo.onclick = () => {
      const last = seq[seq.length - 1];

      if (last === "❌") {
        seq.pop(); // supprime ❌
      } else if (last === "✅") {
        // Supprimer un seul ✅ depuis la fin
        for (let i = seq.length - 1; i >= 0; i--) {
          if (seq[i] === "✅") {
            seq.splice(i, 1); // retire 1 seule réussite
            break;
          } else {
            break;
          }
        }
      }

      socket.emit("player_correction", {
        matchId,
        playerId: activePlayerId
      });

      renderSequence();
    };
    container.appendChild(undo);
  }

  sequenceArea.appendChild(container);
}

function renderCountdown(ms) {
  const minutes = Math.floor(ms / 60000).toString().padStart(2, "0");
  const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
  statusContainer.innerHTML = `<button id="countdownButton" class="validate-button">⏱️ ${minutes}:${seconds} ▶️</button>`;
  const btn = document.getElementById("countdownButton");
  btn.disabled = false;
  btn.onclick = () => socket.emit("start_match", matchId);
}

function startCountdown() {
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const now = Date.now();
  const end = matchStartedAt + matchDuration * 60000;
  const remaining = Math.max(0, end - now);
  const minutes = Math.floor(remaining / 60000).toString().padStart(2, "0");
  const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");

  if (remaining <= 0) {
    clearInterval(countdownInterval);
    statusContainer.innerHTML = `<button class="validate-button" id="finalizeButton">✅ Valider les résultats</button>`;
    document.getElementById("finalizeButton").onclick = () => {
      if (confirm("Valider les résultats ? Cette action est irréversible.")) {
        socket.emit("finalize_match", matchId);
      }
    };
  } else {
    const btn = document.getElementById("countdownButton");
    if (btn) btn.textContent = `⏱️ ${minutes}:${seconds}`;
  }
}

function renderScoreboard(scores) {
  const tbody = scoreTable.querySelector("tbody");
  tbody.innerHTML = "";
  const displayScores = players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0 }));
  displayScores.sort((a, b) => b.score - a.score);
  displayScores.forEach((entry, index) => {
    const tr = document.createElement("tr");
    tr.classList.toggle("active", entry.id === activePlayerId);
    tr.innerHTML = `<td>${index + 1}</td><td>${entry.name}</td><td style="text-align:right">${entry.score}</td>`;
    tbody.appendChild(tr);
  });
}

function handleKeyPress(key) {
  if (!activePlayerId || matchFinished || !matchStartedAt) return;
  if (!playerSequences[activePlayerId]) playerSequences[activePlayerId] = [];

  if (key === "fail") {
    clearTimeout(bufferTimer);
    numberBuffer = "";
    playerSequences[activePlayerId].push("❌");
    socket.emit("player_sequence", { matchId, playerId: activePlayerId, sequence: ["❌"] });
    renderSequence();
    return;
  }

  numberBuffer += key;
  renderSequence();
  clearTimeout(bufferTimer);
  failButton.disabled = true;

  bufferTimer = setTimeout(() => {
    const n = parseInt(numberBuffer);
    const added = [];
    for (let i = 0; i < n; i++) added.push("✅");
    added.push("❌");
    playerSequences[activePlayerId].push(...added);
    socket.emit("player_sequence", { matchId, playerId: activePlayerId, sequence: added });
    numberBuffer = "";
    bufferTimer = null;
    failButton.disabled = false;
    renderSequence();
  }, 2000);
}

successActionBtn.onclick = () => {
  if (!activePlayerId || matchFinished || !matchStartedAt) return;
  if (!playerSequences[activePlayerId]) playerSequences[activePlayerId] = [];

  const seq = playerSequences[activePlayerId];
  const last = seq[seq.length - 1];

  if (last === "✅") {
    // Ajoute à la série actuelle
    seq.push("✅");
  } else {
    // Nouvelle série
    seq.push("✅");
  }

  socket.emit("player_sequence", {
    matchId,
    playerId: activePlayerId,
    sequence: ["✅"]
  });

  renderSequence();
};

failActionBtn.onclick = () => {
  if (!activePlayerId || matchFinished || !matchStartedAt) return;
  if (!playerSequences[activePlayerId]) playerSequences[activePlayerId] = [];

  playerSequences[activePlayerId].push("❌");

  socket.emit("player_sequence", {
    matchId,
    playerId: activePlayerId,
    sequence: ["❌"]
  });

  renderSequence();
};

