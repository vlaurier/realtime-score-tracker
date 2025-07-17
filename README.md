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

## Instructions d'implémentation

- L'application doit être responsive et adaptée à une visualisation sur smartphone.
- une barre d'entête est présente sur toutes les pages. Elle reste visible même en scrollant.
- elle contient de façon centrée le titre de la page que l'on visite
- une barre de pied de page, visible sur toutes les pages (sauf l'accueil) contient de façon centrée une petite icône d'une ferrari avec l'intitulé "Menu" qui redirige vers la page d'accueil
- la page d'accueil est un empilement de liens sous forme de boutons : "Créer une Classic Race", "Classic races à jouer", "Résultats", "Enregistrer un nouveau joueur".
- le lien "Enregistrer un nouveau joueur" mène à la page players.html
- la page players.html a pour titre 'Liste des participants' et propose un formulaire avec un champ unique "Nom du joueur" et un bouton "Ajouter".
- Sous ce formulaire apparaît après une délimitation horizontale la liste des joueurs enregistrés par ordre alphabétique.
- Les joueurs sont sauvegardés dans un fichier players.json qui est trié à chaque ajout de joueurs afin d'être utilisable tel quel
- la page new_match.html propose un formulaire avec : Durée (en minutes) et un multiselect "Sélectionner les joueurs" puis un bouton "Créer le match"
- elle renvoie directement sur la page du match crée
- la page match.html a pour titre Math du "dd/MM/YYYY HH:mm" avec la date de création du match
- elle affiche un bouton avec un chronomètre non démarré dont la valeur est la durée renseignée préalablement
- elle liste ensuite les joueurs participants sous forme de boutons cliquables
- au clic sur un joueur l'application fait apparaître deux boutons "manqué" et "réussi" pour enregistrer les succès ou échec successifs d'un joueur
- qu'importe le joueur, les boutons sont grisés tant que l'on n'a pas cliqué sur le bouton chronomètre pour lancer le compte à rebours
- au lancement du chronomètre, les boutons deviennent cliquables pour tous les joueurs, mais seuls les boutons du joueur que l'on sélectionne sont visibles
- on peut changer de joueur en cliquant sur le bouton correspondant. on peut alors enregister ses échecs et succès.
- cliquer sur les boutons "manqué" ou "réussi" va progressivement faire apparaître sous les boutons en question une séquence
- un premier clic sur "manqué" fait apparaître une pastille rouge avec un 1 à l'intérieur
- un second clic incrémente le 1, qui devient 2 et ainsi de suite
- le fonctionnement est le même pour "réussi", mais un clic fait apparaitre une pastille verte. 5 clics consécutifs feront par exemple apparaître un 5 dans une pastille verte
- un bouton de correction, lorsqu'il est pressé, décrémente de 1 un score enregistré, que ce soit réussite ou échec
- exemple : On a les pastilles 3 rouge et 2 vert. Un clic sur le bouton de correction (flèche retour à la fin de la séquence affichée), donnera : 3 rouge 1 vert
- si on reclic sur la correction, dans la mesure où la valeur dans la pastille vert est 1, cela la fera disparaître. Même chose pour les pastilles rouges. On peut alors tout corriger si l'on veut en décrémentant et en supprimant les pastilles quand le chiffre passe de 1 à 0
- sous la liste des joueurs (où chaque bouton joueur est attaché à une partie visible/cachable de sa séquence et des boutons pour l'enregistrer) apparaît un classement
- le classement montre en temps réel le classement des joueurs par ordre croissant de la somme des réussites enregistrées
- à la fin du chronomètre, un bouton "sauvegarder" apparaît au dessus de la liste des joueurs
- la sauvegarde d'un match consiste à sauvegarder les séquences pour chaque participants, le classement pouvant être reconstitué à partir de cela
- la page "matches.html" permet de gérer les éléments du menu "Classic races à jouer"  et "Résultats"
- elle liste dans le premier cas les matchs qui ne sont pas encore sauvegardés et dans le second les matchs sauvegardés
- en cliquant sur un match non sauvegardé, on arrive sur la page match avec le comportement décrit plus haut qui permet de saisir les score en temps réel et de suivre le classement
- en cliquant sur un match sauvegardé, on peut consulter le classement
- l'ensemble de l'application présente un style dynamique et professionnel qui joue sur l'aspect "course". Le design est épurée avec un rose/rouge qui contraste élégamment avec le gris/noir des boutons non sélectionnés et ou header. 

## 🙌 Auteurs

- Projet conçu par @vlaurier, développé en quasi intégralité avec l’IA.

## 🏁 Licence

- MIT — Utilisation libre à condition de mentionner l'auteur.






