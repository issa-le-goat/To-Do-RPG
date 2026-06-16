package Functions

import (
	"database/sql"
	"fmt"
)

func CompleteTaskAndUpdateXP(db *sql.DB, taskID int, userID int) error {
	// Utilisation d'une transaction pour garantir que XP et statut de tâche sont mis à jour ensemble
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() // Annule tout en cas d'erreur avant le Commit()

	var state string
	var expReward int
	err = tx.QueryRow("SELECT State, Exp_Reward FROM task WHERE ID = ? AND ID_User = ?", taskID, userID).Scan(&state, &expReward)
	if err != nil {
		return fmt.Errorf("tâche introuvable ou non autorisée")
	}
	if state == "done" {
		return fmt.Errorf("tâche déjà terminée")
	}

	// Validation de la tâche
	_, err = tx.Exec("UPDATE task SET State = 'done' WHERE ID = ?", taskID)
	if err != nil {
		return err
	}

	// Récupération des stats du joueur
	var lvl, exp, expNext int
	err = tx.QueryRow("SELECT Lvl, Exp, ExpNext FROM users WHERE ID = ?", userID).Scan(&lvl, &exp, &expNext)
	if err != nil {
		return err
	}

	// Calcul du niveau
	exp += expReward
	for exp >= expNext {
		exp -= expNext
		lvl++
		expNext = int(float64(expNext) * 1.5) // Courbe de progression (ex: +50% d'XP requise au niveau suivant)
	}

	// Mise à jour de l'utilisateur
	_, err = tx.Exec("UPDATE users SET Lvl = ?, Exp = ?, ExpNext = ? WHERE ID = ?", lvl, exp, expNext, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}