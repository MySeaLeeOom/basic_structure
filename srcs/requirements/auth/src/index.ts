import fastify from 'fastify'
import postgres from '@fastify/postgres'
import { readFileSync } from 'node:fs'; //for getting the secret from a file
import {drizzle} from 'drizzle-orm/node-postgres'
// import * as schema from './db/schema';    // Your tables (not ready)

// import { randomUUID } from 'node:crypto';
// const sessionID = randomUUID(); //this is for the UUID/session

// AUTH_DB_URL=postgres://${AUTH_DB_USER}:${AUTH_DB_PASSWORD}@${POSTGRES}/${AUTH_DB_NAME} 


const server = fastify()

const user = process.env.AUTH_DB_USER as string;
const db_name = process.env.AUTH_DB_NAME as string;
const host = process.env.POSTGRES_SERVICE as string;
const auth_pass = readFileSync('/run/secrets/auth_db_password', 'utf8').trim();
const connectionString = `postgres://${user}:${auth_pass}@${host}/${db_name}`;

// this register db ass a plugin, the server makes sure the connection is there  
// (pool of connections)
server.register(postgres, {
  connectionString: connectionString,
  max: 10,
  idleTimeoutMillis: 30000, //this is time sitting waiting in pool
  statement_timeout: 500 //5 seconds searching db
});

server.get('/ping', async (request, reply) => {
  return 'pong\n'
})

// logic for initial login
server.get('/api/auth/login', async (request, reply) => {
})

// separate one for checking cookie
server.get('/api/auth/', async (request, reply) => {

})


server.listen({ port: 8080 }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})