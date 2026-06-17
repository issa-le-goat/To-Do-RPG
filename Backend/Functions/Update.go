package Functions

import (
	"database/sql"
	"fmt"
)

func CompleteTaskAndUpdateXP(db *sql.DB, taskID int, userID int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var state string
	var expReward int
	tableName := "task"

	// 1. Cherche la tâche dans la table classique
	err = tx.QueryRow("SELECT State, Exp_Reward FROM task WHERE ID = ? AND ID_User = ?", taskID, userID).Scan(&state, &expReward)
	if err != nil {
		// 2. Si introuvable, cherche dans la table récurrente
		err = tx.QueryRow("SELECT State, Exp_Reward FROM recurring_task WHERE ID = ? AND ID_User = ?", taskID, userID).Scan(&state, &expReward)
		if err != nil {
			return fmt.Errorf("tâche introuvable ou non autorisée")
		}
		tableName = "recurring_task"
	}

	if state == "done" {
		return fmt.Errorf("tâche déjà terminée")
	}

	// Met à jour la bonne table
	query := fmt.Sprintf("UPDATE %s SET State = 'done' WHERE ID = ?", tableName)
	_, err = tx.Exec(query, taskID)
	if err != nil {
		return err
	}

	var lvl, exp, expNext int
	err = tx.QueryRow("SELECT Lvl, Exp, ExpNext FROM users WHERE ID = ?", userID).Scan(&lvl, &exp, &expNext)
	if err != nil {
		return err
	}

	exp += expReward
	for exp >= expNext {
		exp -= expNext
		lvl++
		expNext = int(float64(expNext) * 1.5)
	}

	_, err = tx.Exec("UPDATE users SET Lvl = ?, Exp = ?, ExpNext = ? WHERE ID = ?", lvl, exp, expNext, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}