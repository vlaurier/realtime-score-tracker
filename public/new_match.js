const form = document.getElementById('new-match-form');
const playersSelect = document.getElementById('players');

async function fetchPlayers() {
  const res = await fetch('/players.json');
  if (!res.ok) return [];
  return res.json();
}

function generateUUID() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function populatePlayers(players) {
  players.sort((a, b) => a.localeCompare(b));
  players.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    playersSelect.appendChild(option);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const duration = parseInt(document.getElementById('duration').value, 10);
  const selected = Array.from(playersSelect.selectedOptions).map(opt => opt.value);

  if (isNaN(duration) || duration <= 0) {
    alert('Durée invalide');
    return;
  }

  if (selected.length === 0) {
    alert('Veuillez sélectionner au moins un joueur');
    return;
  }

  // Désactiver le formulaire et montrer le chargement
  form.style.display = 'none';
  document.getElementById('loading').style.display = 'block';

  const uuid = generateUUID();
  const match = {
    id: uuid,
    createdAt: nowISO(),
    duration,
    players: selected,
    sequences: Object.fromEntries(selected.map(p => [p, []])),
    status: "ongoing",
    startTimestamp: null
  };

  try {
    async function createWithRetry(maxAttempts = 5) {
      let attempt = 0;
      let lastErr;
      while (attempt < maxAttempts) {
        attempt++;
        try {
          const response = await fetch('/api/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(match)
          });
          if (response.ok) return response.json();
          // Retry for 5xx/503
          if (response.status >= 500) {
            await new Promise(r => setTimeout(r, 300 * attempt));
            continue;
          }
          // For 409/400 (should not happen), stop
          throw new Error('Erreur serveur: ' + response.status);
        } catch (e) {
          lastErr = e;
          // Network errors -> retry with backoff
          await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
      throw lastErr || new Error('Echec réseau');
    }

    const data = await createWithRetry(6);
    // Aller directement à la page du match (le serveur garantit la lisibilité)
    window.location.href = `/match.html?id=${data.id}`;
  } catch (error) {
    form.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    console.error('Erreur:', error);
    alert('Erreur lors de la création du match: ' + error.message);
  }
});

fetchPlayers().then(populatePlayers);