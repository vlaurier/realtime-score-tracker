// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const matches = []; // Stockage temporaire en mémoire
const players = [];

app.use(express.static('public'));

const matchPlayers = {}; // clé = matchId, valeur = tableau de noms

io.on('connection', (socket) => {
  console.log('🟢 Nouveau client connecté');

  // Envoie la liste existante au nouveau client
  socket.emit('matches', matches);

  // Quand un match est créé
  socket.on('create_match', (match) => {
    const newMatch = {
      id: uuidv4(),
      name: match.name,
      duration: match.duration,
      createdAt: new Date().toISOString(),
      started: false, // futur contrôle
    };

    matches.push(newMatch);
    io.emit('matches', matches); // Envoie à tous les clients
  });

  // Quand un match est supprimé
  socket.on('delete_match', (matchId) => {
    console.log('Suppression demandée pour le match :', matchId);
    const match = matches.find(m => m.id === matchId);

    if (match && !match.started) {
      const index = matches.findIndex(m => m.id === matchId);
      matches.splice(index, 1);
      io.emit('matches', matches);
    }
  });

  socket.on('add_player', (playerName) => {
    if (typeof playerName !== 'string' || !playerName.trim()) return;

    const name = playerName.trim();
    // Empêche les doublons exacts (non sensible à la casse)
    if (!players.find(p => p.toLowerCase() === name.toLowerCase())) {
      players.push(name);
      players.sort((a, b) => a.localeCompare(b));
      io.emit('players_updated', players);
    }
  });

  socket.on('get_players', () => {
    socket.emit('players_updated', players);
  });

  socket.on('add_player_to_match', ({ matchId, playerName }, ack) => {
    if (!matchId || !playerName) return;

    if (!matchPlayers[matchId]) {
      matchPlayers[matchId] = [];
    }

    if (!matchPlayers[matchId].includes(playerName)) {
      matchPlayers[matchId].push(playerName);
      io.emit('match_players_updated', { matchId, players: matchPlayers[matchId] });
      io.emit('player_added_to_match', { matchId, playerName });
      io.emit('matches', matches); // 🔁 Force la mise à jour du tableau matchId → nom
    }

    if (ack) ack(); // Envoie l'accusé de réception
  });

  socket.on('get_match_players', (matchId) => {
    const list = matchPlayers[matchId] || [];
    socket.emit('match_players', {
      matchId,
      players: list.map(name => ({ id: name, name }))
    });
  });

  socket.on('match_players_updated', ({ matchId, players }) => {
    matchPlayers[matchId] = players;
    socket.emit('matches'); // redemande la liste pour re-render
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client déconnecté');
  });

});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`✅ Serveur en écoute sur http://localhost:${PORT}`);
});
