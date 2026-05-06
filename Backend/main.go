package main

import (
	"database/sql"
	"log"
	"todo-app/router"
	_ "github.com/go-sql-driver/mysql"
	"fmt"
)

func main() {
	// Connexion DB
	db, err := sql.Open("mysql", "root:root@tcp(127.0.0.1:8889)/votre_base")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Initialisation du routeur via notre fichier router.go
	r := router.SetupRouter(db)

	// Lancement
	r.Run(":3000")
	fmt.Println("Serveur lancé sur le port 3000")
}