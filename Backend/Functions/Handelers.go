package Functions

import (
	"database/sql"
	"net/http"
	"strconv"
	"github.com/gin-gonic/gin"
)

type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginInput struct {
	Identifier string `json:"identifier" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

type TaskInput struct {
	UserID      int    `json:"user_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	DueDate     string `json:"due_date" binding:"required"` 
	Duration    int    `json:"duration" binding:"required"`
	Priority    int    `json:"priority"`
	Recurring   bool   `json:"recurring"` // Nouveau champ
}

type CompleteTaskInput struct {
	UserID int `json:"user_id" binding:"required"`
}

// --- POST Handlers ---

func RegisterHandler(c *gin.Context, db *sql.DB) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides"})
		return
	}
	newID, err := CreateUser(db, input.Name, input.Password, input.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de créer l'utilisateur"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Utilisateur créé", "userID": newID})
}

func LoginHandler(c *gin.Context, db *sql.DB) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides"})
		return
	}
	user, err := Login(db, input.Identifier, input.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Identifiants incorrects"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Connexion réussie", "user": user})
}

func CreateTaskHandler(c *gin.Context, db *sql.DB) {
	var input TaskInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Données invalides"})
		return
	}

	if input.Recurring {
		// On utilise DueDate comme Start_Time
		err := CreateRecurringTask(db, input.UserID, input.Name, input.Duration, input.Priority, input.DueDate, input.Description)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la création récurrente"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "Tâche récurrente créée"})
	} else {
		err := CreateTask(db, input.UserID, input.Name, input.Duration, input.Priority, input.DueDate, input.Description)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la création"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "Tâche créée"})
	}
}

// --- GET Handlers ---

func GetUserProfileHandler(c *gin.Context, db *sql.DB) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	profile, err := GetUserProfile(db, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilisateur introuvable"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func GetTasksHandler(c *gin.Context, db *sql.DB) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	tasks, err := GetTasksByState(db, userID, "todo")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur serveur"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tasks": tasks})
}

func GetRecurringTasksHandler(c *gin.Context, db *sql.DB) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	tasks, err := GetRecurringTasks(db, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur serveur"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"recurring_tasks": tasks})
}


func GetCompletedTasksHandler(c *gin.Context, db *sql.DB) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	tasks, err := GetTasksByState(db, userID, "done")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur serveur"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tasks": tasks})
}

func GetLeaderboardHandler(c *gin.Context, db *sql.DB) {
	leaderboard, err := GetLeaderboard(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur serveur"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"leaderboard": leaderboard})
}

// --- PUT Handlers ---

func CompleteTaskHandler(c *gin.Context, db *sql.DB) {
	taskID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de tâche invalide"})
		return
	}
	var input CompleteTaskInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Utilisateur requis dans le body"})
		return
	}

	err = CompleteTaskAndUpdateXP(db, taskID, input.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Tâche terminée, XP mise à jour !"})
}

// --- DELETE Handlers ---

func DeleteTaskHandler(c *gin.Context, db *sql.DB) {
	taskID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de tâche invalide"})
		return
	}
	userID, _ := strconv.Atoi(c.Query("user_id")) // Ex: DELETE /tasks/5?user_id=1

	err = DeleteTask(db, taskID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Tâche supprimée"})
}

func DeleteUserHandler(c *gin.Context, db *sql.DB) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	err = DeleteUser(db, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Utilisateur supprimé"})
}

