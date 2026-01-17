from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Note(BaseModel):
	id: str = None 
	title: str
	content: str

# here just an array - ahmet will do magic great fantastic db
db = []

@app.get("/notes")
async def get_notes():
	return db

@app.post("/notes")
async def create_note(note: Note):
	global	id_index
	id_index += 1
	note.id = id_index
	db.append(note)
	return note