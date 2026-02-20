20.02.26

- pnpm add -D pino-pretty: pino is an intergrated logger in fastify, it is super fast but naturally outputs logs in one line, with an entire json being one line. This makes it human readable
- pnpm add @fastify/oauth2: fastify native OAUTH2 libary, wrapper of simple-oauth2

2 endpoints needed:
- one to redirect to a provider url
- one use that we send to provider to redirect to us and discover fi they are verifies 
