package Functions

import (
	"database/sql"
	"fmt"
	"todo-app/Modules"
)

func Login(db *sql.DB, identifier string, plainPassword string) (*Modules.User, error) {
	u := &Modules.User{}
	var hashedPassword string
	var email string // Pour stocker l'email récupéré

	// La requête cherche une correspondance sur le nom OU sur l'email
	query := `
		SELECT ID, Name, Email, Password, Lvl, Exp, ExpNext 
		FROM Users 
		WHERE Name = ? OR Email = ?`
	
	// On passe "identifier" deux fois pour remplir les deux points d'interrogation
	err := db.QueryRow(query, identifier, identifier).Scan(
		&u.ID, &u.Name, &email, &hashedPassword, &u.Lvl, &u.Exp, &u.ExpNext,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("identifiants incorrects")
		}
		return nil, err
	}

	// Vérification du mot de passe avec Bcrypt
	if !CheckPasswordHash(plainPassword, hashedPassword) {
		return nil, fmt.Errorf("identifiants incorrects")
	}

	return u, nil
}