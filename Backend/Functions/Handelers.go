package Functions

import (
	"database/sql"
	"github.com/gin-gonic/gin"
	"net/http"
)

func LoginHandler(c *gin.Context, db *sql.DB) {
	c.JSON(http.StatusOK, gin.H{"message": "Route Login fonctionnelle"})
}

func RegisterHandler(c *gin.Context, db *sql.DB) {
	c.JSON(http.StatusOK, gin.H{"message": "Route Register fonctionnelle"})
}

func CreateTaskHandler(c *gin.Context, db *sql.DB) {
	c.JSON(http.StatusOK, gin.H{"message": "Route Create Task fonctionnelle"})
}

func DeleteUserHandler(c *gin.Context, db *sql.DB) {
	c.JSON(http.StatusOK, gin.H{"message": "Route Delete User fonctionnelle"})
}

func DeleteTaskHandler(c *gin.Context, db *sql.DB) {
	c.JSON(http.StatusOK, gin.H{"message": "Route Delete Task fonctionnelle"})
}