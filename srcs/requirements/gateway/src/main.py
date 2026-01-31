from fastapi import Request, Depends, FastAPI, HTTPException, status, Response
from starlette.responses import FileResponse 

app = FastAPI()

SERVICES = {
	"notes": "http://notes:8000"
}

@app.get("/")
async def index():
	return FileResponse("src/index.html")

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"])
async def forward(request: Request):
	service = request.url.path
	upstream = SERVICES.get(service, None)
	print(f"the service is: {service}")
	if upstream is None:
		return Response(status_code=404)
	print(f"forward to: {service}, url = {request.url}")
	return Response(status_code=200)