package Functions

import (
	"database/sql"
	"fmt"
)

func DeleteTask(db *sql.DB, taskID int, userID int) error {
	// On ajoute l'ID_User dans la clause WHERE par sécurité
	query := "DELETE FROM Task WHERE ID = ? AND ID_User = ?"
	
	result, err := db.Exec(query, taskID, userID)
	if err != nil {
		return fmt.Errorf("erreur lors de la suppression : %v", err)
	}

	// On vérifie si une ligne a effectivement été supprimée
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("tâche non trouvée ou vous n'avez pas l'autorisation")
	}

	fmt.Printf("Tâche %d supprimée avec succès.\n", taskID)
	return nil
}

func DeleteUser(db *sql.DB, userID int) error {
	// 1. Préparation de la requête
	query := "DELETE FROM Users WHERE ID = ?"
	
	// 2. Exécution
	result, err := db.Exec(query, userID)
	if err != nil {
		return fmt.Errorf("erreur lors de la suppression de l'utilisateur : %v", err)
	}

	// 3. Vérification du résultat
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("aucun utilisateur trouvé avec l'ID %d", userID)
	}

	fmt.Printf("Utilisateur %d et toutes ses données associées ont été supprimés.\n", userID)
	return nil
}