# Motivation et contexte du projet

Ce projet vise à organiser des parties de billard français, selon un mode inspiré du "Classic Race", pour la partie libre.
Rappelons les règles traditionnelles de la partie libre au billard français.
- le jeu possède 3 billes : rouge, jaune et blanche
- chaque joueur a une bille attitrée, soit blanche, soit jaune
- un joueur marque un point chaque fois qu'il touche avec sa bille les deux autres billes
- un joueur continue à jouer tant qu'il marque des points
- on appelle série une succesion de plusieurs points réussis

Le mode 'Classic Race' propose que les joueurs ne jouent plus en alternance sur le même billard, mais marquent le plus de points possibles en un temps donné, chacun sur leur billard respectif.

---

## 🏁 Classic Race — Matchs chronométrés multijoueur

L'application web légère permet d’organiser un match chronométré (dit "Classic race"), impliquant un ou plusieurs joueurs.
Elle se destine principalement aux marqueurs, personnes qui vont comptabiliser les points d'un joueur donné sur un billard.
A cet effet, l'application doit être optimisée pour les téléphones et synchronisée entre les appareils.
Elle permet de définir la durée d'un match, les participants, de rentrer les séquences de points réussis ou ratés pour chaque joueur et de suivre en temps réel le classement des joueurs qui s'affrontent.

---

## 🚀 Fonctionnalités du MVP

- Ajouter un participant potentiel et lister les existants.
- Créer une **Classic Race** avec une durée choisie et une liste de joueurs.
- Démarrer manuellement un match avec affichage d’un **chronomètre**.
- Saisir pour chaque joueur des séries et des échecs, grâce à un **clavier numérique intégré**
- Mise à jour **en temps réel** des scores et des séquences = suite de séries et échecs.
- **Correction** possible des séquences à l'aide d'un bouton retour qui supprime la dernière saisie.
- **Validation finale** des résultats à la fin du chrono.
- Navigation possible par plusieurs marqueurs/observateurs pour rejoindre un match en cours.
- Consultation des résultats des classic races terminées.

---

## 📁 Structure du projet

```
/
├── public/
│ ├── index.html → Page d’accueil avec le menu principal
│ ├── new_match.html → Création d’un nouveau match
│ ├── match.html → Suivi en temps réel d’un match
│ ├── players.html → Enregistrement de joueurs
│ ├── matches.html → Liste des matchs filtrés (en cours / terminés)
│ ├── style.css → Styles communs à toutes les pages
│ ├── match.js → Logique JS spécifique à match.html
│ ├── matches.js → Logique JS pour la liste des matchs
├── server.js → Serveur Express + Socket.IO
├── package.json → Dépendances + scripts
```

---

## 🧠 Technologies utilisées

- **Node.js** avec [Express](https://expressjs.com/)
- **WebSocket** via [Socket.IO](https://socket.io/)
- **Vanilla JS** (aucune dépendance frontend)
- **CSS minimaliste** responsive
- Données stockées via des fichiers en json (pas de base de données)

---

## 🧪 Démarrer le projet en local
[README.md](README.md)
```bash
git clone https://github.com/vlaurier/realtime-score-tracker.git
cd realtime-score-tracker
npm install
npx nodemon server.js
```

## 🔧 Instructions d’implémentation

- L'application est responsive et optimisée pour une utilisation sur smartphone.
- Une **barre d'entête** est présente sur toutes les pages, fixe en haut même au scroll, avec le **titre centré** de la page en cours.
- Une **barre de pied de page**, visible sur toutes les pages sauf l’accueil, contient de façon centrée une **icône Ferrari** accompagnée du texte “Menu” qui redirige vers la page d’accueil.

### 🏠 `index.html` — Page d’accueil
- Boutons de navigation empilés verticalement :
  - “Créer une Classic Race” → `new_match.html`
  - “Classic races à jouer” → `matches.html?status=ongoing`
  - “Résultats” → `matches.html?status=completed`
  - “Enregistrer un nouveau joueur” → `players.html`

### 🧑 `players.html` — Gestion des joueurs
- Titre : “Liste des participants”
- Formulaire avec champ unique : `Nom du joueur` + bouton `Ajouter`
- Format : `prénom espace initiale du nom` (ex : `Julien M`)
- Pas de doublon possible
- Les noms sont stockés dans `players.json` **trié par ordre alphabétique**

### 🆕 `new_match.html` — Création d’un match
- Formulaire avec :
  - Durée (en minutes)
  - Multiselect “Sélectionner les joueurs” (au moins un, sans doublons)
- À la validation :
  - Création d’un fichier `matches/match-UUID.json`
  - Ajout d’une entrée dans `matches.json`
  - Redirection vers `match.html?id=UUID`

### 🎯 `match.html` — Suivi de match en temps réel
- Titre : “Match du dd/MM/YYYY HH:mm”
- Chronomètre initialisé à la durée définie, bouton `Démarrer`
- Liste des joueurs sous forme de boutons cliquables
- Sélection d’un joueur → apparition des boutons “réussi” (vert) et “manqué” (rouge)
- Avant démarrage : tous les boutons d’action sont désactivés
- Après démarrage : seuls les boutons du joueur sélectionné sont visibles et actifs
- À chaque clic :
  - Une pastille apparaît ou est incrémentée (ex : rouge 3 pour 3 échecs)
  - Les pastilles rouges (échecs) et vertes (réussites) s'affichent dans l’ordre
- Le bouton `correction` décrémente ou supprime la dernière pastille saisie
- Chaque joueur a sa propre séquence visible
- Le **classement temps réel** (par total de réussites) est affiché sous les joueurs
- Toute interaction est **synchronisée en temps réel** via Socket.IO
- Chaque client peut enregistrer les actions pour un joueur sans interférer avec les autres
- Le chronomètre est **informel** : aucune restriction après son expiration
- Une fois le match terminé, un bouton `Sauvegarder` apparaît pour valider les données

### 🗂️ `matches.html` — Liste des matchs
- Affiche :
  - Les matchs **en cours** (`status=ongoing`)
  - Les matchs **terminés** (`status=completed`)
- Clic sur un match en cours → `match.html?id=UUID`
- Clic sur un match terminé → consultation du classement statique reconstitué

### 💾 Persistance
- `players.json` : liste triée des noms uniques
- `matches.json` : liste des métadonnées de tous les matchs (UUID, date, durée, joueurs, statut)
- Chaque match est stocké dans `/matches/match-UUID.json` avec la structure :

```json
{
  "id": "uuid",
  "createdAt": "2025-07-17T14:00:00.000Z",
  "duration": 30,
  "players": ["Alice B", "Julien M"],
  "sequences": {
    "Alice B": ["+3", "-1", "+2", "-1"],
    "Julien M": ["+1", "+1", "-2"]
  },
  "status": "ongoing" | "completed",
  "startTimestamp": "2025-07-17T14:05:00.000Z"
}
```

- Seules les pastilles vertes (succès, notées +x) comptent dans le score final
- Les pastilles rouges (-x) sont affichées pour information mais ne retirent pas de points

### ⏱️ Chronomètre & reconnexion

- Lorsqu’un client rejoint un match dont le chrono est démarré, le temps restant est recalculé dynamiquement depuis startTimestamp
- Aucune action n’est bloquée à la fin du chrono
- La sélection du joueur est locale à chaque client

### 🎨 Design

- Design épuré et dynamique inspiré de la course
- Couleurs : rose/rouge vif, gris foncé/noir pour les éléments inactifs
- Contraste marqué, lisibilité mobile optimisée
- L’icône Ferrari est intégrée dans le pied de page (à fournir si nécessaire)

## 🙌 Auteurs

- Projet conçu par @vlaurier, développé en quasi intégralité avec l’IA.

## 🏁 Licence

- MIT — Utilisation libre à condition de mentionner l'auteur.






