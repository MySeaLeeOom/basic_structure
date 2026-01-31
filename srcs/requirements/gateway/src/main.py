from fastapi import Request, Depends, FastAPI, HTTPException, status, Response
from starlette.responses import FileResponse
import httpx

app = FastAPI()

http_client = httpx.AsyncClient()

SERVICES = {
	"/api/notes": "http://notes:8000/api/notes"
}

# index.html  had to be moved from nginx to here
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
	body = await request.body()
	headers = dict(request.headers)
	method = request.method
	query_params = dict(request.query_params)
	#
	print(f"  body: {body}")
	print(f"  headers: {headers}")
	print(f"  method: {method}")
	print(f"  query_params: {query_params}")
	print(f"  upstream: {upstream}")
	#
	response = await http_client.request(
		method,
		str(upstream),
		content=body,
		params=query_params,
		headers=headers
	)
	print(f"-> reponse: {response}")
	#
	#
	return Response(
        content=response.content,
        status_code=response.status_code,
        headers=dict(response.headers),
    )
