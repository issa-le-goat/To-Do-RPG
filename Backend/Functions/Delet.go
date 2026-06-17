package Functions

import (
	"database/sql"
	"fmt"
)

func DeleteTask(db *sql.DB, taskID int, userID int) error {
	// 1. Tente de supprimer dans la table classique
	res, err := db.Exec("DELETE FROM task WHERE ID = ? AND ID_User = ?", taskID, userID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()

	// 2. Si aucune ligne n'a été supprimée, on tente dans la table récurrente
	if rows == 0 {
		res, err = db.Exec("DELETE FROM recurring_task WHERE ID = ? AND ID_User = ?", taskID, userID)
		if err != nil {
			return err
		}
		rows, _ = res.RowsAffected()
		if rows == 0 {
			return fmt.Errorf("tâche non trouvée ou non autorisée")
		}
	}
	return nil
}

func DeleteUser(db *sql.DB, userID int) error {
	query := "DELETE FROM users WHERE ID = ?"
	result, err := db.Exec(query, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("aucun utilisateur trouvé")
	}
	return nil
}