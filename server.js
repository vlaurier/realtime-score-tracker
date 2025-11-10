const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { Server } = require("socket.io");
const { createServer } = require("http");

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

// Vérification de l'existence de la base de données
const fs = require('fs');
const dbPath = "scores.db";
const isNewDatabase = !fs.existsSync(dbPath);

// Initialisation de la base de données SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Erreur de connexion à la base de données:", err);
    process.exit(1);
  }
  console.log("✅ Connecté à la base de données SQLite");
});

// Activation des clés étrangères
db.run("PRAGMA foreign_keys = ON");

// Création des tables uniquement si c'est une nouvelle base
if (isNewDatabase) {
  console.log("📦 Nouvelle base de données détectée, création des tables...");
  
  db.serialize(() => {
    // Table des joueurs
    db.run(`CREATE TABLE IF NOT EXISTS players (
      name TEXT PRIMARY KEY
    )`).run(`CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)`);
    console.log("✅ Table 'players' créée");

    // Table des matches
    db.run(`CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      duration INTEGER,
      status TEXT DEFAULT 'ongoing',
      start_timestamp TEXT DEFAULT NULL
    )`).run(`CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)`);
    console.log("✅ Table 'matches' créée");

    // Table des joueurs par match
    db.run(`CREATE TABLE IF NOT EXISTS match_players (
      match_id TEXT,
      player_name TEXT,
      FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY(player_name) REFERENCES players(name) ON DELETE CASCADE,
      PRIMARY KEY(match_id, player_name)
    )`);
    console.log("✅ Table 'match_players' créée");

    // Table des séquences de jeu
    db.run(`CREATE TABLE IF NOT EXISTS sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT,
      player_name TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN,
      FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY(player_name) REFERENCES players(name) ON DELETE CASCADE
    )`).run(`CREATE INDEX IF NOT EXISTS idx_sequences_match ON sequences(match_id)`);
    console.log("✅ Table 'sequences' créée");

    console.log("✅ Initialisation de la base de données terminée");
  });
} else {
  console.log("✅ Base de données existante détectée, aucune création de table nécessaire");
}

// Helper functions pour les promesses
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Socket.IO
io.on("connection", (socket) => {
  console.log("🟢 Client connecté");
  let currentMatch = null;

  socket.on("join", (matchId) => {
    console.log(`Client rejoint le match: ${matchId}`);
    // Quitter l'ancien match si nécessaire
    if (currentMatch) {
      socket.leave(currentMatch);
    }
    socket.join(matchId);
    currentMatch = matchId;
  });

  socket.on("update", (data) => {
    if (!data || !data.matchId) {
      console.error("Mise à jour invalide reçue");
      return;
    }

    console.log(`Mise à jour reçue pour le match ${data.matchId}:`, data.type);
    
    // Envoyer la mise à jour à TOUS les clients dans la salle, y compris l'émetteur
    io.in(data.matchId).emit("update", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client déconnecté");
    if (currentMatch) {
      socket.leave(currentMatch);
    }
  });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Serveur lancé sur http://localhost:${PORT}`));

// Nettoyage à la fermeture
process.on('SIGINT', () => {
  db.close(() => {
    console.log('Base de données fermée');
    process.exit(0);
  });
});

// Route pour gérer les joueurs
app.get("/players.json", async (req, res) => {
  try {
    const players = await dbAll("SELECT name FROM players ORDER BY name");
    console.log('Joueurs trouvés:', players);
    res.json(players.map(p => p.name));
  } catch (error) {
    console.error('Erreur lors de la récupération des joueurs:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/players", async (req, res) => {
  console.log('Réception de nouveaux joueurs:', req.body);
  const players = Array.from(new Set(req.body)).sort((a, b) => a.localeCompare(b));
  console.log('Liste triée:', players);
  
  try {
    await db.run("BEGIN TRANSACTION");
    console.log('Transaction démarrée');
    
    await dbRun("DELETE FROM players");
    console.log('Anciens joueurs supprimés');
    
    for (const player of players) {
      console.log('Ajout du joueur:', player);
      await dbRun("INSERT INTO players (name) VALUES (?)", [player]);
    }
    
    await db.run("COMMIT");
    console.log('Transaction validée');
    res.sendStatus(200);
  } catch (error) {
    await db.run("ROLLBACK");
    console.error('Erreur lors de la sauvegarde des joueurs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour lister les matches
app.get("/api/matches", async (req, res) => {
  try {
    const matches = await dbAll(`
      SELECT m.*, GROUP_CONCAT(mp.player_name) as players
      FROM matches m
      LEFT JOIN match_players mp ON m.id = mp.match_id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `);
    
    // Pour chaque match, récupérer les séquences
    const matchesWithSequences = await Promise.all(matches.map(async match => {
      // Récupérer les séquences triées par timestamp
      const sequences = await dbAll(
        `SELECT player_name, timestamp, success 
         FROM sequences 
         WHERE match_id = ?
         ORDER BY timestamp ASC`,
        [match.id]
      );
      
      // Organiser les séquences par joueur
      const sequencesByPlayer = {};
      match.players.split(',').forEach(player => {
        sequencesByPlayer[player] = [];
      });

      let currentSeries = {};
      sequences.forEach(seq => {
        if (!currentSeries[seq.player_name]) {
          currentSeries[seq.player_name] = 0;
        }

        if (seq.success) {
          currentSeries[seq.player_name]++;
        } else {
          if (currentSeries[seq.player_name] > 0) {
            sequencesByPlayer[seq.player_name].push(`+${currentSeries[seq.player_name]}`);
          }
          sequencesByPlayer[seq.player_name].push("-0");
          currentSeries[seq.player_name] = 0;
        }
      });

      // Ajouter les dernières séries en cours
      Object.entries(currentSeries).forEach(([player, count]) => {
        if (count > 0) {
          sequencesByPlayer[player].push(`+${count}`);
        }
      });

      return {
        ...match,
        players: match.players.split(','),
        sequences: sequencesByPlayer
      };
    }));
    
    res.json(matchesWithSequences);
  } catch (error) {
    console.error('Erreur lors de la récupération des matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Routes pour les matches
app.post("/api/match", async (req, res) => {
  const match = req.body;
  console.log('Création de match:', match);

  if (!match.id || !Array.isArray(match.players) || typeof match.duration !== "number") {
    console.log('Payload invalide:', match);
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    await db.run("BEGIN TRANSACTION");
    console.log('Transaction démarrée');

    // S'assurer que tous les joueurs existent
    for (const player of match.players) {
      console.log('Vérification du joueur:', player);
      await dbRun("INSERT OR IGNORE INTO players (name) VALUES (?)", [player]);
    }

    // Insertion du match
    console.log('Insertion du match');
    await dbRun(
      "INSERT INTO matches (id, created_at, duration, status) VALUES (?, ?, ?, ?)",
      [match.id, match.createdAt, match.duration, match.status || 'ongoing']
    );

    // Insertion des joueurs du match
    console.log('Association des joueurs au match');
    for (const player of match.players) {
      await dbRun(
        "INSERT INTO match_players (match_id, player_name) VALUES (?, ?)",
        [match.id, player]
      );
    }

    await db.run("COMMIT");
    console.log('Transaction validée, match créé avec succès');
    res.status(201).json({ id: match.id });
  } catch (error) {
    await db.run("ROLLBACK");
    console.error('Erreur lors de la création du match:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/match/:id", async (req, res) => {
  try {
    // Récupérer les informations du match
    const match = await dbAll(
      `SELECT m.*, GROUP_CONCAT(mp.player_name) as players
       FROM matches m
       LEFT JOIN match_players mp ON m.id = mp.match_id
       WHERE m.id = ?
       GROUP BY m.id`,
      [req.params.id]
    );

    if (match.length === 0) {
      return res.sendStatus(404);
    }

    // Récupérer les séquences du match
    const sequences = await dbAll(
      "SELECT player_name, success FROM sequences WHERE match_id = ? ORDER BY timestamp",
      [req.params.id]
    );

    // Formater la réponse
    const matchData = {
      id: match[0].id,
      createdAt: match[0].created_at,
      duration: match[0].duration,
      players: match[0].players.split(','),
      status: match[0].status,
      startTimestamp: match[0].start_timestamp,
      sequences: {}
    };

    // Organiser les séquences par joueur avec le format +1/-0
    for (const player of matchData.players) {
      matchData.sequences[player] = sequences
        .filter(s => s.player_name === player)
        .map(s => s.success ? "+1" : "-0");
    }

    console.log('Match data prepared:', matchData);
    res.json(matchData);
  } catch (error) {
    console.error('Erreur lors de la récupération du match:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/match/:id", async (req, res) => {
  const match = req.body;

  try {
    await db.run("BEGIN TRANSACTION");

    await dbRun(
      "UPDATE matches SET status = ?, start_timestamp = ? WHERE id = ?",
      [match.status, match.startTimestamp, match.id]
    );

    // Mise à jour du match
    await dbRun(
      "UPDATE matches SET status = ?, start_timestamp = ? WHERE id = ?",
      [match.status, match.startTimestamp, match.id]
    );

    // Si des séquences sont fournies, les mettre à jour
    if (match.sequences) {
      await dbRun("DELETE FROM sequences WHERE match_id = ?", [match.id]);

      const now = new Date().toISOString();
      for (const [player, sequences] of Object.entries(match.sequences)) {
        if (Array.isArray(sequences)) {
          for (const seq of sequences) {
            if (seq.startsWith('+')) {
              const count = parseInt(seq.slice(1), 10) || 0;
              for (let i = 0; i < count; i++) {
                await dbRun(
                  "INSERT INTO sequences (match_id, player_name, timestamp, success) VALUES (?, ?, ?, ?)",
                  [match.id, player, now, true]
                );
              }
            } else if (seq === '-0') {
              await dbRun(
                "INSERT INTO sequences (match_id, player_name, timestamp, success) VALUES (?, ?, ?, ?)",
                [match.id, player, now, false]
              );
            }
          }
        }
      }
    }

    await db.run("COMMIT");
    res.json({ status: "ok", ...match });
  } catch (error) {
    await db.run("ROLLBACK");
    console.error('Erreur lors de la mise à jour du match:', error);
    res.status(500).json({ error: error.message });
  }
});
