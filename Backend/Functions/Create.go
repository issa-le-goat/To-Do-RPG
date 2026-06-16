package Functions

import (
	"database/sql"
	"fmt"
	"log"
)

func CreateTask(db *sql.DB, userID int, name string, duration int, priority int, dueDate string, description string) error {
	expReward := (duration / 15) * 10 * priority

	query := `INSERT INTO task (ID_User, Name, Duration, Priority, Exp_Reward, Due_Date, Description, State) VALUES (?, ?, ?, ?, ?, ?, ?, 'todo')`
	_, err := db.Exec(query, userID, name, duration, priority, expReward, dueDate, description)
	
	if err != nil {
		log.Printf("Erreur création tâche : %v", err)
		return err
	}
	return nil
}

func CreateUser(db *sql.DB, name string, plainPassword string, email string) (int64, error) {
	hashedPassword, err := HashPassword(plainPassword)
	if err != nil {
		return 0, err
	}

	// Correspondance stricte avec les colonnes Mdp et Mail
	query := "INSERT INTO users (Name, Mdp, Mail) VALUES (?, ?, ?)"
	
	result, err := db.Exec(query, name, hashedPassword, email)
	if err != nil {
		return 0, fmt.Errorf("erreur lors de la création: %v", err)
	}

	return result.LastInsertId()
}

func CreateRecurringTask(db *sql.DB, userID int, name string, duration int, priority int, startTime string, description string) error {
	expReward := (duration / 15) * 10 * priority

	query := `INSERT INTO recurring_task (ID_User, Name, Duration, Priority, Exp_Reward, Start_Time, Description, State) VALUES (?, ?, ?, ?, ?, ?, ?, 'todo')`
	_, err := db.Exec(query, userID, name, duration, priority, expReward, startTime, description)
	
	if err != nil {
		log.Printf("Erreur création tâche récurrente : %v", err)
		return err
	}
	return nil
}