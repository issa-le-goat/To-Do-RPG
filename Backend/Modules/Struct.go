package Modules

import "time"

type User struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"-"` // Le "-" empêche d'exposer le hash du mot de passe
	Lvl      int    `json:"lvl"`
	Exp      int    `json:"exp"`
	ExpNext  int    `json:"exp_next"`
	Rank     string `json:"rank"`
	Progress int    `json:"progress"` // Pourcentage de complétion
}

type Task struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	Duration    int       `json:"duration"` // en minutes
	Priority    int       `json:"priority"`
	State       string    `json:"state"`
	ExpReward   int       `json:"exp_reward"`
}

type LeaderboardEntry struct {
	Name  string `json:"name"`
	Level int    `json:"lvl"`
}