// server.js
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const {v4: uuidv4} = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const matches = []; // Stockage temporaire en mémoire
const players = ["Alice", "Bob", "Charlie"];

app.use(express.static('public'));

const matchPlayers = {}; // clé = matchId, valeur = tableau de noms
const matchData = {}; // matchId → { players: { [playerId]: ['✅', '✅', '❌', ...] } }

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
            started: false,
            startedAt: null,
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

    socket.on('get_all_match_players', () => {
      const all = {};
      for (const matchId in matchPlayers) {
        all[matchId] = matchPlayers[matchId];
      }
      socket.emit('all_match_players', all);
    });

    socket.on('add_player_to_match', ({matchId, playerName}, ack) => {
        if (!matchId || !playerName) return;

        if (!matchPlayers[matchId]) {
            matchPlayers[matchId] = [];
        }

        if (!matchPlayers[matchId].includes(playerName)) {
            matchPlayers[matchId].push(playerName);
            io.emit('match_players_updated', {matchId, players: matchPlayers[matchId]});
            io.emit('player_added_to_match', {matchId, playerName});
            io.emit('matches', matches); // 🔁 Force la mise à jour du tableau matchId → nom
        }

        if (ack) ack(); // Envoie l'accusé de réception
    });

    socket.on('start_match', (matchId) => {
        const match = matches.find(m => m.id === matchId);
        if (!match) {
            console.warn(`❌ Tentative de démarrage pour un match inconnu : ${matchId}`);
            return;
        }

        if (match.started) {
            console.log(`⚠️ Match ${match.name} déjà démarré (ignorer double appel)`);
            return;
        }

        match.started = true;
        match.startedAt = Date.now();
        console.log(`🕒 Match "${match.name}" démarré à ${new Date(match.startedAt).toISOString()}`);

        io.emit('match_started', {matchId, startedAt: match.startedAt});
        io.emit('matches', matches);
    });


    socket.on('get_match_info', (matchId) => {
        const match = matches.find(m => m.id === matchId);
        if (match) {
            socket.emit('match_info', match);
        }
    });

    socket.on('get_match_players', (matchId) => {
        const list = matchPlayers[matchId] || [];
        socket.emit('match_players', {
            matchId,
            players: list.map(name => ({id: name, name}))
        });
    });

    socket.on('match_players_updated', ({matchId, players}) => {
        matchPlayers[matchId] = players;
        socket.emit('matches'); // redemande la liste pour re-render
    });

    socket.on('disconnect', () => {
        console.log('🔴 Client déconnecté');
    });

    socket.on('player_sequence', ({ matchId, playerId, sequence }) => {
      if (!matchId || !playerId || !Array.isArray(sequence)) return;

      if (!matchData[matchId]) {
        matchData[matchId] = { players: {} };
      }

      if (!matchData[matchId].players[playerId]) {
        matchData[matchId].players[playerId] = [];
      }

      // Ajoute la séquence au joueur
      matchData[matchId].players[playerId].push(...sequence);

      // 🧮 Calcul du score brut (nb de ✅)
        const scores = {};
        for (const [pid, seq] of Object.entries(matchData[matchId].players)) {
          scores[pid] = seq.filter(a => a === '✅').length;
        }

        io.to(matchId).emit('score_update', {
          matchId,
          scores
        });
    });

    socket.on('join_match', (matchId) => {
        socket.join(matchId);
        // Recalcule et envoie le score actuel à ce nouveau client
        const data = matchData[matchId];
        if (data && data.players) {
            const scores = {};
            for (const [pid, seq] of Object.entries(data.players)) {
                scores[pid] = seq.filter(s => s === '✅').length;
            }
            socket.emit('score_update', {matchId, scores});
        }
    });

    socket.on('player_correction', ({ matchId, playerId }) => {
      if (!matchId || !playerId) return;

      const currentMatch = matchData[matchId];
      if (!currentMatch || !currentMatch.players[playerId]) return;

      const sequence = currentMatch.players[playerId];

      if (!sequence.length) return;

      const last = sequence[sequence.length - 1];

      if (last === '❌') {
        sequence.pop();
      } else if (last === '✅') {
        while (sequence.length && sequence[sequence.length - 1] === '✅') {
          sequence.pop();
        }
      }

      // ✅ Corriger ici également (la ligne qui pose problème)
      const scores = {};
      for (const [pid, seq] of Object.entries(currentMatch.players)) {
        scores[pid] = seq.filter(a => a === '✅').length;
      }

      io.to(matchId).emit('score_update', {
        matchId,
        scores
      });
    });

    socket.on('finalize_match', (matchId) => {
      const match = matches.find(m => m.id === matchId);
      if (!match || !match.started || match.finished) return;

      match.finished = true;
      io.emit('match_finalized', { matchId });
    });

    socket.on('get_player_sequence', ({ matchId, playerId }) => {
      const sequence = matchData[matchId]?.players?.[playerId] || [];
      socket.emit('player_sequence_data', { matchId, playerId, sequence });
    });

    socket.on('get_player_sequences', (matchId) => {
      const data = matchData[matchId];
      if (!data || !data.players) return;

      // Envoie toutes les séquences à ce client
      socket.emit('player_sequences', {
        matchId,
        sequences: data.players  // { playerId: ['✅', '❌', ...] }
      });
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`✅ Serveur en écoute sur http://localhost:${PORT}`);
});
