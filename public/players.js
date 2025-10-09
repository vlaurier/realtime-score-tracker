const form = document.getElementById('add-player-form');
const input = document.getElementById('player-name');
const list = document.getElementById('players-list');

async function fetchPlayers() {
  const res = await fetch('/players.json');
  if (!res.ok) return [];

  return res.json();
}

async function displayPlayers() {
  const players = await fetchPlayers();
  players.sort((a, b) => a.localeCompare(b));
  list.innerHTML = '';

  players.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    list.appendChild(li);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = input.value.trim();

  if (!name.match(/^[A-Za-zÀ-ÿ]+ [A-Z]$/)) {
    alert("Format invalide (ex: Julien M)");
    return;
  }

  let players = await fetchPlayers();
  if (players.includes(name)) {
    alert("Ce joueur existe déjà.");
    return;
  }

  players.push(name);
  players.sort((a, b) => a.localeCompare(b));

  // Enregistrement sur le serveur
  await fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(players)
  });

  input.value = '';
  displayPlayers();
});

displayPlayers();
