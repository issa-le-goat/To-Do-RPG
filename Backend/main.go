package main

import (
	"database/sql"
	"fmt"
	"log"
	"todo-app/router"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	// Connexion DB : ajout de parseTime=true pour formater correctement les DATETIME
	dsn := "root:root@tcp(127.0.0.1:3306)/to_do_list?parseTime=true"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Erreur d'ouverture de la base de données : ", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatal("Impossible de se connecter à la base de données : ", err)
	}

	r := router.SetupRouter(db)

	fmt.Println("Serveur lancé sur le port 3000")
	r.Run(":3000")
}