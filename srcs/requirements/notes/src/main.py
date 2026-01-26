from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import logging
import asyncpg
import os


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

DATABASE_URL = f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'postgres')}/{os.getenv('DB_NAME', 'transcendence')}"

@app.middleware("http")
async def log_requests(request: Request, call_next):
	logger.info(f"Path: {request.url.path}")
	logger.info(f"Method: {request.method}")
	logger.info(f"Headers: {dict(request.headers)}")
	body = await request.body()
	if body:
		logger.info(f"Body: {body.decode()}")
	response = await call_next(request)
	return response

class Note(BaseModel):
	id: int = None
	title: str
	content: str

@app.get("/api/notes")
async def get_notes():
	conn = await asyncpg.connect(DATABASE_URL)
	rows = await conn.fetch("SELECT id, title, content FROM notes")
	await conn.close()
	return [dict(row) for row in rows]

@app.get("/api/notes/{id}")
async def get_note(id: int):
	conn = await asyncpg.connect(DATABASE_URL)
	try:
		row = await conn.fetchrow(
			"SELECT id, title, content FROM notes WHERE id = $1",
			id
		)
		if row is None:
			raise HTTPException(status_code=404, detail="Note not found")
		return dict(row)
	finally:
		await conn.close()
		return dict(row)

@app.post("/api/notes")
async def create_note(note: Note):
	conn = await asyncpg.connect(DATABASE_URL)
	row = await conn.fetchrow(
		"INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING id, title, content",
		note.title, note.content
	)
	await conn.close()
	return dict(row)
