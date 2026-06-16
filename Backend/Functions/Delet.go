package Functions

import (
	"database/sql"
	"fmt"
)

func DeleteTask(db *sql.DB, taskID int, userID int) error {
	query := "DELETE FROM task WHERE ID = ? AND ID_User = ?"
	result, err := db.Exec(query, taskID, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("tâche non trouvée ou non autorisée")
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