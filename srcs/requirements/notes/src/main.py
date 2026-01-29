from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncpg
import os

app = FastAPI()

DB_URL = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@postgres/{os.getenv('DB_NAME')}"

class Note(BaseModel):
    title: str
    content: str

@app.get("/api/notes")
async def get_all():
	conn = await asyncpg.connect(DB_URL)
	try:
		rows = await conn.fetch("SELECT id, title, content FROM notes")
		return [dict(r) for r in rows]
	finally:
		await conn.close()


@app.post("/api/notes")
async def create(note: Note):
	conn = await asyncpg.connect(DB_URL)
	try:
		row = await conn.fetchrow(
			"INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING id, title, content",
			note.title, note.content
		)
		return dict(row)
	finally:
		await conn.close()





# maartooons attempt for ovvveerrlooading get requests :)
#
# @app.get("/api/notes/{id}")
# async def get_note(id: int):
# 	conn = await asyncpg.connect(DB_URL)
# 	try:
# 		row = await conn.fetchrow(
# 			"SELECT id, title, content FROM notes WHERE id = $1",
# 			id
# 		)
# 		if row is None:
# 			raise HTTPException(status_code=404, detail="Note not found")
# 		return dict(row)
# 	finally:
# 		await conn.close()
# 		return dict(row)