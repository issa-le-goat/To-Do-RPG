package Functions

import (
	"database/sql"
	"fmt"
	"todo-app/Modules"
)

func Login(db *sql.DB, identifier string, plainPassword string) (*Modules.User, error) {
	u := &Modules.User{}
	var hashedPassword string 

	query := `SELECT ID, Name, Mail, Mdp, Lvl, Exp, ExpNext FROM users WHERE Name = ? OR Mail = ?`
	
	err := db.QueryRow(query, identifier, identifier).Scan(&u.ID, &u.Name, &u.Email, &hashedPassword, &u.Lvl, &u.Exp, &u.ExpNext)
	if err != nil {
		return nil, fmt.Errorf("identifiants incorrects")
	}

	if !CheckPasswordHash(plainPassword, hashedPassword) {
		return nil, fmt.Errorf("identifiants incorrects")
	}
	return u, nil
}

func GetUserProfile(db *sql.DB, userID int) (*Modules.User, error) {
	u := &Modules.User{}
	query := `SELECT ID, Name, Mail, Lvl, Exp, ExpNext FROM users WHERE ID = ?`
	
	err := db.QueryRow(query, userID).Scan(&u.ID, &u.Name, &u.Email, &u.Lvl, &u.Exp, &u.ExpNext)
	if err != nil {
		return nil, err
	}

	// Calcul du rang et de la progression
	if u.Lvl < 10 {
		u.Rank = "Bronze"
	} else if u.Lvl < 20 {
		u.Rank = "Argent"
	} else if u.Lvl < 30 {
		u.Rank = "Or"
	} else if u.Lvl < 40 {
		u.Rank = "Platine"
	} else {
		u.Rank = "Diamant"
	}

	if u.ExpNext > 0 {
		u.Progress = int((float64(u.Exp) / float64(u.ExpNext)) * 100)
	}

	return u, nil
}

func GetTasksByState(db *sql.DB, userID int, state string) ([]Modules.Task, error) {
	var tasks []Modules.Task
	query := `SELECT ID, ID_User, Name, Description, Due_Date, Duration, Priority, State, Exp_Reward FROM task WHERE ID_User = ? AND State = ? ORDER BY Due_Date ASC`

	rows, err := db.Query(query, userID, state)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var t Modules.Task
		err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.Description, &t.DueDate, &t.Duration, &t.Priority, &t.State, &t.ExpReward)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func GetLeaderboard(db *sql.DB) ([]Modules.LeaderboardEntry, error) {
	query := "SELECT Name, Lvl FROM users ORDER BY Lvl DESC LIMIT 10"
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var leaderboard []Modules.LeaderboardEntry
	for rows.Next() {
		var entry Modules.LeaderboardEntry
		if err := rows.Scan(&entry.Name, &entry.Level); err != nil {
			return nil, err
		}
		leaderboard = append(leaderboard, entry)
	}
	return leaderboard, nil
}