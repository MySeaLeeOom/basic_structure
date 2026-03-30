import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LLM-Gateway")

app = FastAPI(title="LLM Gateway - Debug Mode")

# --- Configuration ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "ollama")
MODEL_NAME = os.getenv("LLM_MODEL", "llama3")
BASE_URL = os.getenv("LLM_BASE_URL")

# Initialize Client
client_args = {"api_key": OPENAI_API_KEY}
if BASE_URL:
    client_args["base_url"] = BASE_URL
client = AsyncOpenAI(**client_args)

class CompletionRequest(BaseModel):
    prompt: str
    system_prompt: str = "You are a helpful assistant."

@app.post("/stream")
async def stream_completion(request: CompletionRequest):
    logger.info(f"Incoming Request for: {MODEL_NAME}")
    logger.debug(f"Prompt: {request.prompt}")
    
    async def generator():
        try:
            stream = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": request.system_prompt},
                    {"role": "user", "content": request.prompt}
                ],
                stream=True,
            )
            logger.info("Connection to LLM established, starting stream...")
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    # Log tokens to console so user can see it in terminal
                    print(content, end="", flush=True)
                    yield f"data: {content}\n\n"
            
            print("\n") # New line in console after completion
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"LLM Stream Error: {str(e)}")
            yield f"data: Error: {str(e)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
