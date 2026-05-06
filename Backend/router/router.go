package router

import (
	"database/sql"
	"github.com/gin-gonic/gin"
	"todo-app/Functions"
)

// SetupRouter centralise la configuration des points d'entrée de l'API
func SetupRouter(db *sql.DB) *gin.Engine {
	r := gin.Default()

	// Groupe pour les utilisateurs
	userRoutes := r.Group("/users")
	{
		userRoutes.POST("/register", func(c *gin.Context) { Functions.RegisterHandler(c, db) })
		userRoutes.POST("/login", func(c *gin.Context) { Functions.LoginHandler(c, db) })
		userRoutes.DELETE("/:id", func(c *gin.Context) { Functions.DeleteUserHandler(c, db) })
	}

	// Groupe pour les tâches
	taskRoutes := r.Group("/tasks")
	{
		taskRoutes.POST("/", func(c *gin.Context) { Functions.CreateTaskHandler(c, db) })
		taskRoutes.DELETE("/:id", func(c *gin.Context) { Functions.DeleteTaskHandler(c, db) })
		//taskRoutes.PUT("/:id/complete", func(c *gin.Context) { Functions.CompleteTaskHandler(c, db) })
	}

	return r
}