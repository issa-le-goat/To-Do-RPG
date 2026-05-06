package Functions

import (
	"database/sql"
	"fmt"
	"log"
)

func CreateTask(db *sql.DB, userID int, name string, duration int, priority int) {
	// Notre petite règle métier : 10 XP par tranche de 15 min * priorité
	expReward := (duration / 15) * 10 * priority

	query := `INSERT INTO Task (ID_User, Name, Duration, Priority, Exp_Reward) VALUES (?, ?, ?, ?, ?)`
	_, err := db.Exec(query, userID, name, duration, priority, expReward)
	
	if err != nil {
		log.Printf("Erreur création tâche : %v", err)
	} else {
		fmt.Printf("Tâche '%s' créée ! Récompense prévue : %d XP\n", name, expReward)
	}
}

func CreateUser(db *sql.DB, name string, plainPassword string) (int64, error) {
	// 1. On hashe le mot de passe avant de l'envoyer à la base
	hashedPassword, err := HashPassword(plainPassword)
	if err != nil {
		return 0, err
	}

	// 2. On insère le nom ET le mot de passe hashé
	query := "INSERT INTO Users (Name, Password) VALUES (?, ?)"
	
	result, err := db.Exec(query, name, hashedPassword)
	if err != nil {
		return 0, fmt.Errorf("erreur lors de la création: %v", err)
	}

	return result.LastInsertId()
}