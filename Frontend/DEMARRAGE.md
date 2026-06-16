# Lancer To-Do-RPG (Frontend relié au Backend)

## Architecture
- `Backend/` : serveur Go (Gin) + MySQL, écoute sur le port 3000.
- `Frontend/` : l'app web (HTML/CSS/JS). Se connecte au back sur :3000.
  Si le back est absent, l'app bascule automatiquement en mode démo local.

## 1. Base de données
Le back se connecte à : `root:root@tcp(127.0.0.1:3306)/to_do_list`
(voir `Backend/main.go`). Vérifie que :
- MySQL tourne sur 3306,
- la base `to_do_list` existe avec les tables `users` et `task`
  (schéma dans `Backend/Tables Sql.docx`).
Si ton mot de passe MySQL diffère, modifie la ligne `dsn` dans `main.go`.

## 2. Lancer le Backend
```bash
cd Backend
go mod tidy      # première fois seulement
go run .
```
Tu dois voir « Serveur lancé sur le port 3000 ».
(Un `server.exe` est fourni : sous Windows tu peux aussi double-cliquer dessus,
mais `go run .` est recommandé pour être sûr d'avoir la dernière version.)

## 3. Lancer le Frontend
L'app charge plusieurs fichiers JS : il faut la servir en HTTP, pas l'ouvrir
en double-cliquant le fichier.
```bash
cd Frontend
python3 -m http.server 5500
```
Puis ouvre http://localhost:5500/index.html
(En VS Code : extension « Live Server », clic droit sur index.html.)

## 4. Vérifier que c'est relié
Crée un compte. Si tu vois ton vrai classement et que les tâches persistent
après rechargement (même après vidage du cache navigateur), c'est branché au
back. Si tu vois des joueurs fictifs (Léa, Tom…), c'est que l'app est en mode
démo : le back n'est pas joignable, vérifie qu'il tourne sur :3000.

## Comment le lien fonctionne
- `Frontend/api.js` : seul fichier qui connaît les routes et les noms de champs
  du back. Login/register, tâches, complétion, leaderboard, profil y sont traduits.
- `Frontend/app-core.js` : l'app. En mode live, l'XP / le niveau / le rang sont
  calculés par le SERVEUR (le front les affiche seulement). En démo, calcul local.

## Détails importants côté gameplay (mode relié au back)
- La récompense en XP d'une tâche est calculée par le serveur :
  (durée / 15) × 10 × priorité. Le champ « Priorité » de la fenêtre de tâche
  pilote donc l'XP ; une estimation s'affiche en direct.
- Terminer une tâche est définitif côté serveur (pas de « refaire »), car le
  back ne propose pas cette opération.
- Modifier une tâche = suppression + recréation (le back n'a pas d'update).
- L'e-mail n'est pas modifiable depuis le profil en mode relié (pas de route).

## Si le back renvoie une erreur SQL au lancement
Le code Go attend précisément ces colonnes :
- table `users` : ID, Name, Mail, Mdp, Lvl, Exp, ExpNext
- table `task`  : ID, ID_User, Name, Description, Due_Date, Duration, Priority, State, Exp_Reward
Si tes colonnes ont d'autres noms, aligne-les avec `Backend/Tables Sql.docx`
ou corrige les requêtes dans `Backend/Functions/`.
