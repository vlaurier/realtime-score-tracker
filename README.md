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
- Données **en mémoire uniquement** (pas de base de données)

---

## 🧪 Démarrer le projet en local
[README.md](README.md)
```bash
git clone https://github.com/vlaurier/realtime-score-tracker.git
cd realtime-score-tracker
npm install
npx nodemon server.js
```

## ⚠️ Limites actuelles (MVP)

- Les données (joueurs, matchs, scores) sont perdues au redémarrage.
- Pas de gestion d’erreurs serveur ni de validation renforcée.
- Pas de tests.

## Prochaines étapes envisagées

Fonctionnelles : 

- Correction des bugs et amélioration du parcours utilisateur.
- Améliorer le tableau des résultats par des statistiques.
- Ajouter une notion de handicap.

Techniques :

- Améliorer la testabilité et la couverture fonctionnelle.
- Ajouter une base de données persistante (SQLite, PostgreSQL…).

## 🙌 Auteurs

- Projet conçu par @vlaurier, développé en quasi intégralité avec l’IA.

## 🏁 Licence

- MIT — Utilisation libre à condition de mentionner l'auteur.






