

// Initialiser Socket.IO avec gestion d'erreur et reconnexion
const socket = io({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('Connecté au serveur Socket.IO');
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
});

socket.on('disconnect', () => {
  console.log('Déconnecté du serveur Socket.IO');
});

const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get("id");
const isReadOnly = urlParams.get("view") === "readonly";

const titleEl = document.getElementById("page-title");
const chronoEl = document.getElementById("chrono");
const startBtn = document.getElementById("start-btn");
const playersContainer = document.getElementById("players");
const sequencesContainer = document.getElementById("sequences");
const rankingEl = document.getElementById("ranking");
const saveBtn = document.getElementById("save-btn");

let matchData;
let selectedPlayer = null;
let localSequences = {};
let chronoInterval = null;

async function loadMatchData() {
  try {
    const response = await fetch(`/match/${matchId}`);
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du chargement du match`);
    }
    matchData = await response.json();
    updateTitle();
    renderPlayers();
    socket.emit('join', matchId);
  } catch (error) {
    console.error('Erreur lors du chargement du match:', error);
    alert('Impossible de charger les données du match. Veuillez rafraîchir la page.');
  }
}

function formatDateTime(isoStr) {
  if (!isoStr) return "Date inconnue";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "Date invalide";
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

function renderPlayers() {
  playersContainer.innerHTML = "";
  matchData.players.forEach((name) => {
    const btn = document.createElement("button");
    btn.textContent = name;
    btn.className = name === selectedPlayer ? "player-btn selected" : "player-btn";
    btn.onclick = () => {
      // Retirer la classe selected de tous les boutons
      document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('selected'));
      // Ajouter la classe au bouton cliqué
      btn.classList.add('selected');
      // Mettre à jour les séquences
      document.querySelectorAll('.sequence-block').forEach(block => {
        if (block.getAttribute('data-player') === name) {
          block.classList.add('active');
          block.classList.remove('inactive');
        } else {
          block.classList.add('inactive');
          block.classList.remove('active');
        }
      });
      selectedPlayer = name;
      updateControls();
    };
    playersContainer.appendChild(btn);
  });
}

function calculateScores() {
  return matchData.players.map(player => {
    const sequences = localSequences[player] || [];
    let total = 0;
    let currentSection = 0;
    
    if (!Array.isArray(sequences)) {
      console.error('Invalid sequences for player', player, ':', sequences);
      return { player, score: 0 };
    }
    
    for (const code of sequences) {
      if (typeof code !== 'string') {
        console.error('Invalid sequence code:', code);
        continue;
      }
      
      try {
        if (code.startsWith("+")) {
          const points = parseInt(code.slice(1), 10);
          if (!isNaN(points)) {
            currentSection += points;
          }
        } else if (code === "-0") {
          total += currentSection;
          currentSection = 0;
        }
      } catch (error) {
        console.error('Error processing sequence code:', code, error);
        continue;
      }
    }
    
    // Add final section if not ended with a miss
    total += currentSection;
    console.log(`Final score for ${player}:`, total);
    
    return { player, score: total };
  });
}

function updateControls() {
  // Récupérer les éléments du DOM avec vérification de leur existence
  const elements = {
    actionZone: document.getElementById("actions"),
    chronoZone: document.getElementById("chrono-container"),
    startBtn: document.getElementById("start-btn"),
    saveBtn: document.getElementById("save-btn")
  };

  // Vérifier chaque élément avant de l'utiliser
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      console.warn(`Element '${key}' not found in DOM`);
    }
  }

  if (isReadOnly || matchData.status === "completed") {
    // Mode lecture seule : cacher les contrôles
    if (elements.actionZone) elements.actionZone.style.display = "none";
    if (elements.startBtn) elements.startBtn.style.display = "none";
    if (elements.saveBtn) elements.saveBtn.style.display = "none";
    
    // Garder le chrono visible pour afficher "Match terminé"
    if (elements.chronoZone) elements.chronoZone.style.display = "block";
  } else {
    // Mode normal
    const hasStarted = !!matchData.startTimestamp;

    if (elements.actionZone) {
      elements.actionZone.style.display = selectedPlayer && hasStarted ? "block" : "none";
    }

    if (elements.chronoZone) {
      elements.chronoZone.style.display = hasStarted ? "block" : "none";
    }

    if (elements.startBtn) {
      elements.startBtn.style.display = hasStarted ? "none" : "block";
    }
  }
}

function updateChrono() {
  if (!matchData.startTimestamp) return;
  
  const start = new Date(matchData.startTimestamp);
  const now = new Date();
  const elapsed = Math.floor((now - start) / 1000);
  const remaining = matchData.duration * 60 - elapsed;

  // Mettre à jour le bouton de sauvegarde
  if (saveBtn) {
    if (remaining <= 0) {
      saveBtn.disabled = false;
      saveBtn.classList.remove("disabled");
    } else {
      saveBtn.disabled = true;
      saveBtn.classList.add("disabled");
    }
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

function renderSequences() {
  sequencesContainer.innerHTML = "";

  matchData.players.forEach((player) => {
    const div = document.createElement("div");
    div.className = `sequence-block ${player === selectedPlayer ? 'active' : 'inactive'}`;
    div.setAttribute('data-player', player);

    const name = document.createElement("h3");
    name.textContent = player;
    div.appendChild(name);

    const seq = localSequences[player] || [];
    const zone = document.createElement("div");
    zone.className = "sequence";

    // Process sequence in sections, each miss starts a new section
    let sections = []; // Array to store each section's hits
    let currentSection = [];
    
    // First, split sequence into sections based on misses
    seq.forEach(code => {
      if (typeof code !== "string") return;
      
      if (code.startsWith("+")) {
        currentSection.push(parseInt(code.slice(1), 10) || 0);
      } else {
        if (currentSection.length > 0) {
          sections.push({hits: currentSection, total: currentSection.reduce((a, b) => a + b, 0)});
        }
        sections.push({miss: true});
        currentSection = [];
      }
    });
    
    // Add last section if it has hits
    if (currentSection.length > 0) {
      sections.push({hits: currentSection, total: currentSection.reduce((a, b) => a + b, 0)});
    }
    
    // Render all sections
    sections.forEach(section => {
      if (section.miss) {
        // Add red cross for misses
        const span = document.createElement("span");
        span.className = "miss";
        span.textContent = "✕";
        zone.appendChild(span);
      } else {
        // Add cumulative total for the section
        const span = document.createElement("span");
        span.className = "hit";
        span.textContent = String(section.total);
        zone.appendChild(span);
      }
    });

    div.appendChild(zone);
    sequencesContainer.appendChild(div);
  });
}

function renderRanking() {
  const scores = calculateScores();
  scores.sort((a, b) => b.score - a.score);

  rankingEl.innerHTML = "";
  scores.forEach((entry, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${entry.player} — ${entry.score} pts`;
    rankingEl.appendChild(li);
  });
}

async function pushSequence(type) {
  if (!selectedPlayer) return;

  try {
    // Initialiser la séquence du joueur si elle n'existe pas
    if (!localSequences[selectedPlayer]) {
      localSequences[selectedPlayer] = [];
    }
    
    // Vérifier que la séquence est bien un tableau
    if (!Array.isArray(localSequences[selectedPlayer])) {
      console.error('Invalid sequence structure for player:', selectedPlayer);
      localSequences[selectedPlayer] = [];
    }

    const sequence = type === "hit" ? "+1" : "-0";
    console.log(`Adding sequence for ${selectedPlayer}:`, sequence);
    
    localSequences[selectedPlayer].push(sequence);

    // Mettre à jour l'affichage
    renderSequences();
    renderRanking();
    
    // Émettre la mise à jour pour les autres clients
    emitUpdate();
    
    // Sauvegarder
    await saveMatch();
    
    console.log('Current sequences for', selectedPlayer, ':', localSequences[selectedPlayer]);
  } catch (error) {
    console.error('Error in pushSequence:', error);
    alert('Erreur lors de l\'enregistrement de la séquence. Veuillez réessayer.');
  }
}

function undoLast() {
  if (!selectedPlayer) return;
  const seq = localSequences[selectedPlayer];
  if (seq && seq.length > 0) {
    seq.pop();
    emitUpdate();
    renderSequences();
    renderRanking();
  }
}

function emitUpdate(type = 'sequences') {
  // Préparer les données à envoyer selon le type de mise à jour
  let updateData = {
    matchId,
    type,
    timestamp: new Date().toISOString()
  };

  switch (type) {
    case 'sequences':
      // Nettoyer les séquences
      const cleanSequences = {};
      for (const [player, sequence] of Object.entries(localSequences)) {
        if (Array.isArray(sequence)) {
          cleanSequences[player] = sequence.filter(code => 
            typeof code === 'string' && (code === '-0' || code.startsWith('+'))
          );
        }
      }
      updateData.sequences = cleanSequences;
      break;

    case 'start':
      updateData.startTimestamp = matchData.startTimestamp;
      break;

    case 'complete':
      updateData.status = 'completed';
      updateData.sequences = localSequences;
      break;
  }

  console.log('Emitting update:', type, updateData);
  socket.emit("update", updateData);
}

function applyUpdate(data) {
  if (!data) {
    console.error('Invalid update data received');
    return;
  }

  console.log('Received update:', data);

  switch (data.type) {
    case 'sequences':
      if (data.sequences) {
        for (const [player, sequence] of Object.entries(data.sequences)) {
          if (Array.isArray(sequence)) {
            localSequences[player] = sequence.filter(code => 
              typeof code === 'string' && (code === '-0' || code.startsWith('+'))
            );
          }
        }
        renderSequences();
        renderRanking();
      }
      break;

    case 'start':
      if (data.startTimestamp) {
        matchData.startTimestamp = data.startTimestamp;
        matchData.status = 'ongoing';
        if (!chronoInterval) {
          chronoInterval = setInterval(updateChrono, 1000);
        }
        updateControls();
        updateChrono();
      }
      break;

    case 'complete':
      if (data.status === 'completed') {
        matchData.status = 'completed';
        localSequences = data.sequences || {};
        if (chronoInterval) {
          clearInterval(chronoInterval);
          chronoInterval = null;
        }
        location.reload(); // Recharger pour afficher le résumé final
      }
      break;
  }
}

async function startMatch() {
  try {
    matchData.startTimestamp = new Date().toISOString();
    await saveMatch();
    
    // Émettre la mise à jour à tous les clients
    emitUpdate('start');
    
    startBtn.style.display = "none";
    updateControls();
    if (!chronoInterval) chronoInterval = setInterval(updateChrono, 1000);
  } catch (error) {
    alert("Erreur lors du démarrage du match. Veuillez réessayer.");
    console.error("Start match error:", error);
  }
}

async function saveMatch() {
  try {
    // Vérifier et nettoyer les séquences avant l'envoi
    const cleanedSequences = {};
    for (const [player, sequences] of Object.entries(localSequences)) {
      if (Array.isArray(sequences)) {
        cleanedSequences[player] = sequences.filter(s => 
          typeof s === 'string' && (s === '-0' || s.startsWith('+'))
        );
      }
    }

    const dataToSave = {
      ...matchData,
      sequences: cleanedSequences
    };

    console.log('Saving match data:', dataToSave);

    const response = await fetch(`/match/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSave)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Save successful:', result);
    
    // Mettre à jour les données locales
    if (result.sequences) {
      localSequences = result.sequences;
      renderSequences();
      renderRanking();
    }

    if (result.status === 'completed') {
      location.reload(); // Recharger la page pour afficher le résumé final
    }

    return result;
  } catch (error) {
    console.error('Error saving match:', error);
    throw error; // Propager l'erreur pour la gestion ailleurs
  }
}

// Initialisation
  fetch(`/match/${matchId}`)
    .then((res) => res.json())
    .then((data) => {
      matchData = data;
      localSequences = JSON.parse(JSON.stringify(data.sequences || {}));
      updateTitle();
      renderPlayers();
      updateControls();
      renderSequences();
      renderRanking();
      
      // Si le match est terminé, afficher le résumé
      if (matchData.status === "completed") {
        const scores = calculateScores();
        const winner = scores.sort((a, b) => b.score - a.score)[0];
        
        // Vérifier si un résumé existe déjà
        let summaryDiv = document.querySelector(".match-summary");
        if (!summaryDiv) {
          summaryDiv = document.createElement("div");
          summaryDiv.className = "match-summary";
          summaryDiv.innerHTML = `
            <div class="winner-info">${winner.player} remporte le match avec ${winner.score} points</div>
            <div class="match-date">Joué le ${formatDateTime(matchData.created_at || matchData.createdAt)}</div>
          `;
          document.querySelector(".container").insertBefore(summaryDiv, document.querySelector(".container").firstChild);
        }

        // Afficher "Match terminé" dans le chrono
        chronoEl.textContent = "Match terminé";
      }
      
      if (matchData.startTimestamp) {
      startBtn.style.display = "none";
      if (!chronoInterval) chronoInterval = setInterval(updateChrono, 1000);
      updateChrono();
    }

    socket.emit("join", matchId);
  });

document.getElementById("hit-btn").onclick = () => pushSequence("hit");
document.getElementById("miss-btn").onclick = () => pushSequence("miss");
document.getElementById("undo-btn").onclick = undoLast;
startBtn.onclick = startMatch;
saveBtn.onclick = async () => {
  if (!saveBtn.disabled && confirm("Confirmez-vous la sauvegarde du match ? Aucune rectification ne sera possible après.")) {
    try {
      // Cacher immédiatement les contrôles
      document.getElementById("actions").style.display = "none";
      saveBtn.style.display = "none";
      
      // Mettre à jour l'état
      matchData.status = "completed";
      
      // Sauvegarder et notifier
      await saveMatch();
      emitUpdate('complete');
      
      // Afficher directement le résumé final sans recharger la page
      const scores = calculateScores();
      const winner = scores.sort((a, b) => b.score - a.score)[0];
      
      const summaryDiv = document.createElement("div");
      summaryDiv.className = "match-summary";
      summaryDiv.innerHTML = `
        <div class="winner-info">${winner.player} remporte le match avec ${winner.score} points</div>
        <div class="match-date">Joué le ${formatDateTime(matchData.created_at || matchData.createdAt)}</div>
      `;
      
      // Remplacer tout le contenu existant par le résumé
      const container = document.querySelector(".container");
      if (container) {
        while (container.firstChild) {
          container.firstChild.remove();
        }
        container.appendChild(summaryDiv);
      }
      
      // Mettre à jour le chrono
      if (chronoEl) chronoEl.textContent = "Match terminé";

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Une erreur est survenue lors de la sauvegarde du match');
    }
  }
};

socket.on("update", applyUpdate);
