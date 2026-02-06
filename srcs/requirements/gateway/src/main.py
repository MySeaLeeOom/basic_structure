from fastapi import Request, FastAPI, Response, Depends, HTTPException
from authlib.integrations.starlette_client import OAuth, OAuthError
from authlib.jose import jwt
import httpx
from pydantic_settings import BaseSettings
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from dataclasses import dataclass
from datetime import datetime

# settings for oauth
class Settings(BaseSettings):
	oidc_client_id: str
	oidc_client_secret: str
	session_secret_key: str
	#oidc_config_endpoint: str

settings = Settings()

print('SETTINGS')
print(settings)

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret_key, https_only=True)

# instance of OAuth
oauth = OAuth()
oauth.register(
	name="auth0",
	#server_metadata_url=settings.oidc_config_endpoint,
    #request_token_url='',
    #request_token_params=None,
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
	client_id=settings.oidc_client_id,
	client_secret=settings.oidc_client_secret,
	#client_kwargs={"scope": "public"},
)

# user class
@dataclass
class User:
	id: str
	name: str

# this we will later replace with a real database
USER_DATABASE: dict[str, User] = dict()

http_client = httpx.AsyncClient()


SERVICES = {
	"/": "http://frontend:3000",
	"/api/notes": "http://notes:8000/api/notes"
}


# to check if user is logged in
async def verify_user(request: Request):
    access_token = request.session.get("access_token")

    if access_token is None:
        raise HTTPException(status_code=401)

    userinfo = await get_github_user_info(access_token)
    user_id = userinfo["id"]
    user = USER_DATABASE.get(user_id, None)

    if user is None:
        raise HTTPException(status_code=401)
    return user


async def get_github_user_info(token: str):
    headers = {
         "authorization": f"bearer {token}"
	}
    response = await http_client.request(
		"GET",
		"https://api.github.com/user",
		headers=headers
	)
    if response.status_code != 200:
         raise HTTPException(status_code=401)
    return response.json()


@app.get("/api/login")
async def login(request: Request):
    # TODO correct way: redirect_uri = request.url_for("auth")
    redirect_uri = 'http://localhost:8081/api/auth'
    # user gets redirected to login page (e.g. on 42 intra)
    # we also pass where to go if the login succeeds
    return await oauth.auth0.authorize_redirect(request, redirect_uri)


@app.get("/api/auth")
async def auth(request: Request):
    # if login successful, we come here
    try:
        # extract jwt (?) token
        token = await oauth.auth0.authorize_access_token(request)
    except OAuthError:
        print("An error occurred while verifying authorization response.")
        raise HTTPException(status_code=401)
    print(token)
    userinfo = await get_github_user_info(token["access_token"])
    print(userinfo)
    if not userinfo:
        raise ValueError()

    user_dict = dict(userinfo)
    user_id = user_dict["id"]
    name = user_dict["login"]
    user = USER_DATABASE.get(user_id, None)

	# if user did not exist, put it in the database
    if user is None:
        user = User(id=user_id, name=name)
        USER_DATABASE[user_id] = user
        print(f"New user created! user_id={user.id} name={user.name}")
    else:
        print(f"The user exists; skipped registration. user_id={user.id} name={user.name}")

	# put the token in the session (encoded as JWT)
    request.session["access_token"] = token["access_token"]
    return RedirectResponse(url="/")


@app.get("/api/userinfo")
async def userinfo(request: Request, user: User = Depends(verify_user)):
    print(f"Successful log in: user_id={user.id} name={user.name}")
    return {
        "userinfo": {
            "id": user.id,
            "name": user.name,
        }
    }


# handler for everything
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"])
async def forward(request: Request, path: str):
    # where is the user trying to go?
	service = request.url.path

	# if it's an API endpoint, forward to the relevant service
    # otherwise, forward to the frontend service
	if service.startswith("/api"):
		upstream = SERVICES.get(service, None)
	else:
		upstream = SERVICES.get("/", None)
	#print(f"the service is: {service}")

	# if it's not a thing, 404
	if upstream is None:
		return Response(status_code=404)

	# craft request
	body = await request.body()
	headers = dict(request.headers)
	method = request.method
	query_params = dict(request.query_params)

	# info for debugging
	print(f"  body: {body}")
	print(f"  headers: {headers}")
	print(f"  method: {method}")
	print(f"  query_params: {query_params}")
	print(f"  upstream: {upstream}")
	print(f"  path: {path}")

	# get response
	response = await http_client.request(
		method,
		f"{upstream.strip(path)}/{path}", # TODO This is wrong for the Vue frontend
		content=body,
		params=query_params,
		headers=headers
	)
	#print(f"-> reponse: {response}")

	return Response(
        content=response.content,
        status_code=response.status_code,
        headers=dict(response.headers),
    )
