package router

import (
	"database/sql"
	"todo-app/Functions"
	"github.com/gin-gonic/gin"
	"net/http"
)

// Middleware CORS pour autoriser le frontend à faire des requêtes
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func SetupRouter(db *sql.DB) *gin.Engine {
	r := gin.Default()
	r.Use(CORSMiddleware())

	userRoutes := r.Group("/users")
	{
		userRoutes.POST("/register", func(c *gin.Context) { Functions.RegisterHandler(c, db) })
		userRoutes.POST("/login", func(c *gin.Context) { Functions.LoginHandler(c, db) })
		userRoutes.GET("/:id/profile", func(c *gin.Context) { Functions.GetUserProfileHandler(c, db) })
		userRoutes.DELETE("/:id", func(c *gin.Context) { Functions.DeleteUserHandler(c, db) })
	}

	taskRoutes := r.Group("/tasks")
	{
		taskRoutes.POST("/", func(c *gin.Context) { Functions.CreateTaskHandler(c, db) })
		taskRoutes.GET("/user/:id", func(c *gin.Context) { Functions.GetTasksHandler(c, db) }) // Tâches à faire
		taskRoutes.GET("/completed/:id", func(c *gin.Context) { Functions.GetCompletedTasksHandler(c, db) })
		taskRoutes.PUT("/:id/complete", func(c *gin.Context) { Functions.CompleteTaskHandler(c, db) })
		taskRoutes.DELETE("/:id", func(c *gin.Context) { Functions.DeleteTaskHandler(c, db) })
	}

	r.GET("/leaderboard", func(c *gin.Context) { Functions.GetLeaderboardHandler(c, db) })

	return r
}