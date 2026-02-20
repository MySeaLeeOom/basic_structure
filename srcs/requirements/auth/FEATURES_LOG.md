## 20.02.26 - Feb 20

- pnpm add -D pino-pretty: pino is an intergrated logger in fastify, it is super fast but naturally outputs logs in one line, with an entire json being one line. This makes it human readable
- pnpm add @fastify/oauth2: fastify native OAUTH2 libary, wrapper of simple-oauth2
- create docs and diagrams to illustrate OAUTH2 
	- initial oauth flow
	- potential options of what to do with credentials
		- create our own user and manage sssions
		- stay connected to provider with read/write privileges (we dont do this)
		- potentially keep multiple providers
- fix nginx config
	- rewrite the request url (take out /api/auth/)  
	- hold auth as variable
	- add relevant headers to track ip or original request and host (!)
	- make nginx config documentation in a README in requirement/nginx/






TODO: 
2 endpoints needed:
- one to redirect to a provider url
- one use that we send to provider to redirect to us and discover fi they are verifies 
