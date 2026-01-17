from fastapi import FastAPI, Request
from pydantic import BaseModel
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

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

# here just an array - ahmet will do magic great fantastic db
db = []
id_index = 0

@app.get("/api/notes")
async def get_notes():
	return db

@app.post("/api/notes")
async def create_note(note: Note):
	global	id_index
	id_index += 1
	note.id = id_index
	db.append(note)
	return note