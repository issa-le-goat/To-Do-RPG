package Modules

type User struct {
	ID	   		int
	Name   		string
	Email  		string
	Password 	string
	Lvl			int
	Exp			int
	ExpNext 	int
}

type Task struct {
	ID			int
	UserID		int
	Name		string
	Des	        string
	Due_Date	string
	Duration	int
	Priority	int
	State		string
	ExpReward	int
}

type RecurringTask struct {
	ID			int
	UserID		int
	Name		string
	Des	        string
	StartTime	string
	Duration	int
	Priority	int
	State		string
	ExpReward	int
}

