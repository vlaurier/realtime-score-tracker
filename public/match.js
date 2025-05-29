const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get("id");
const initialPlayer = urlParams.get("player") || null;

let matchStartedAt = null;
let matchDuration = null;
let countdownInterval = null;
let matchFinished = false;
let players = [];
let activePlayerId = initialPlayer;
let numberBuffer = "";
let bufferTimer = null;
const playerSequences = {}; // { playerId: [✅, ✅, ❌] }

// DOM elements
const playerButtonsDiv = document.getElementById("playerButtons");
const numericKeyboard = document.getElementById("numericKeyboard");
const sequenceArea = document.getElementById("sequenceArea");
const statusContainer = document.getElementById("statusContainer");
const scoreTable = document.getElementById("scoreTable");
const failButton = document.getElementById("failButton");
const notification = document.getElementById("notification");
const matchTitle = document.getElementById("matchTitle");

// Initial data
socket.emit("get_match_info", matchId);
socket.emit("get_match_players", matchId);
socket.emit("get_player_sequences", matchId);
socket.emit("join_match", matchId);

// Event listeners
socket.on("match_info", (match) => {
  matchDuration = match.duration;
  if (match.name) matchTitle.textContent = match.name;
  if (match.started && match.startedAt) {
    matchStartedAt = match.startedAt;
    startCountdown();
  } else {
    renderCountdown(match.duration * 60 * 1000);
    enableCountdownStart();
  }
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
  startCountdown();
});

socket.on("match_finalized", ({ matchId: id }) => {
  if (id !== matchId) return;
  matchFinished = true;
  numericKeyboard.style.display = "none";
});

socket.on("player_sequences", ({ matchId: id, sequences }) => {
  if (id !== matchId) return;
  Object.entries(sequences).forEach(([pid, seq]) => playerSequences[pid] = [...seq]);
  renderSequence();
});

socket.on("score_update", ({ matchId: id, scores }) => {
  if (id !== matchId) return;
  console.log("📊 Scores reçus :", scores);
  renderScoreboard(scores);
});

// UI rendering
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
      numericKeyboard.style.display = matchStartedAt && !matchFinished ? "grid" : "none";
    };
    playerButtonsDiv.appendChild(btn);
  });
}

function renderSequence() {
  if (!activePlayerId) return;
  const seq = playerSequences[activePlayerId] || [];
  const container = document.createElement("div");
  container.className = "sequence-container";
  sequenceArea.innerHTML = "";

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
      const fail = document.createElement("div");
      fail.textContent = "❌";
      fail.className = "sequence-item fail";
      container.appendChild(fail);
    }
  });

  if (streak > 0) {
    const s = document.createElement("div");
    s.textContent = streak;
    s.className = "sequence-item success";
    container.appendChild(s);
  }

  if (numberBuffer) {
    const tmp = document.createElement("div");
    tmp.textContent = numberBuffer;
    tmp.className = "sequence-item temp";
    container.appendChild(tmp);
  }

  const undo = document.createElement("button");
  undo.textContent = "↩";
  undo.className = "sequence-correct-button";
  undo.onclick = () => {
    const seq = playerSequences[activePlayerId];
    if (!seq || seq.length === 0) return;
    const last = seq[seq.length - 1];
    if (last === "❌") {
      seq.pop();
    } else {
      while (seq.length && seq[seq.length - 1] === "✅") {
        seq.pop();
      }
    }
    socket.emit("player_correction", { matchId, playerId: activePlayerId });
    renderSequence();
  };
  container.appendChild(undo);
  sequenceArea.appendChild(container);
}

function handleKeyPress(key) {
  if (!activePlayerId || matchFinished) return;
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

function renderCountdown(ms) {
  const minutes = Math.floor(ms / 60000).toString().padStart(2, "0");
  const seconds = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
  statusContainer.innerHTML = `<button id="countdownButton" class="validate-button" disabled>⏱️ ${minutes}:${seconds} ▶️</button>`;
}

function startCountdown() {
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
  numericKeyboard.style.display = "grid";
}

function updateCountdown() {
  const now = Date.now();
  const end = matchStartedAt + matchDuration * 60000;
  const remaining = Math.max(0, end - now);
  const minutes = Math.floor(remaining / 60000).toString().padStart(2, "0");
  const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");

  const btn = document.getElementById("countdownButton");
  if (btn) btn.textContent = `⏱️ ${minutes}:${seconds}`;

  if (remaining <= 0) {
    clearInterval(countdownInterval);
    statusContainer.innerHTML = `<button class="validate-button" id="finalizeButton">✅ Valider les résultats</button>`;
    document.getElementById("finalizeButton").onclick = () => {
      if (confirm("Valider les résultats ? Cette action est irréversible.")) {
        socket.emit("finalize_match", matchId);
      }
    };
  }
}

function enableCountdownStart() {
  statusContainer.innerHTML = `<button id="countdownButton" class="validate-button">⏱️ 00:00 ▶️</button>`;
  const btn = document.getElementById("countdownButton");
  btn.disabled = false;
  btn.onclick = () => socket.emit("start_match", matchId);
}

function renderScoreboard(scores) {
  const tbody = document.querySelector('#scoreTable tbody');
  tbody.innerHTML = '';

  const displayScores = players.map(p => {
    const score = scores[p.id] || 0;
    return { name: p.name, score, id: p.id };
  });

  displayScores.sort((a, b) => b.score - a.score);

  displayScores.forEach((entry, index) => {
    const tr = document.createElement('tr');
    tr.classList.toggle('active', entry.id === activePlayerId);

    const rankTd = document.createElement('td');
    rankTd.textContent = index + 1;

    const nameTd = document.createElement('td');
    nameTd.textContent = entry.name;

    const scoreTd = document.createElement('td');
    scoreTd.textContent = entry.score;
    scoreTd.style.textAlign = 'right';

    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(scoreTd);
    tbody.appendChild(tr);
  });
}

numericKeyboard.querySelectorAll("button").forEach(btn => {
  btn.onclick = () => handleKeyPress(btn.dataset.key || btn.textContent);
});
