from fastapi import Request, FastAPI, Response
import httpx

app = FastAPI()

http_client = httpx.AsyncClient()

SERVICES = {
	"/": "http://frontend:3000",
	"/api/notes": "http://notes:8000/api/notes"
}

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"])
async def forward(request: Request, path: str):
	service = request.url.path
	if service.startswith("/api"):
		upstream = SERVICES.get(service, None)
	else:
		upstream = SERVICES.get("/", None)
	print(f"the service is: {service}")
	#
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
	print(f"  path: {path}")
	#
	response = await http_client.request(
		method,
		f"{upstream}/{path}",
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
