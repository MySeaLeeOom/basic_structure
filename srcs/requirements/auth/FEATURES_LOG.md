## 20.02.26 - Feb 20

- pnpm add -D pino-pretty: pino is an intergrated logger in fastify, it is super fast but naturally outputs logs in one line, with an entire json being one line. This makes it human readable
  - why: for prometheus 

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

### Access_token
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
### User api call
{
  login: 'catdev42',
  id: 139005538,
  node_id: 'U_kgDOCEkOYg',
  avatar_url: 'https://avatars.githubusercontent.com/u/139005538?v=4',
  gravatar_id: '',
  url: 'https://api.github.com/users/catdev42',
  html_url: 'https://github.com/catdev42',
  followers_url: 'https://api.github.com/users/catdev42/followers',
  following_url: 'https://api.github.com/users/catdev42/following{/other_user}',
  gists_url: 'https://api.github.com/users/catdev42/gists{/gist_id}',
  starred_url: 'https://api.github.com/users/catdev42/starred{/owner}{/repo}',
  subscriptions_url: 'https://api.github.com/users/catdev42/subscriptions',
  organizations_url: 'https://api.github.com/users/catdev42/orgs',
  repos_url: 'https://api.github.com/users/catdev42/repos',
  events_url: 'https://api.github.com/users/catdev42/events{/privacy}',
  received_events_url: 'https://api.github.com/users/catdev42/received_events',
  type: 'User',
  user_view_type: 'public',
  site_admin: false,
  name: null,
  company: null,
  blog: '',
  location: null,
  email: null,
  hireable: null,
  bio: null,
  twitter_username: null,
  notification_email: null,
  public_repos: 40,
  public_gists: 0,
  followers: 13,
  following: 2,
  created_at: '2023-07-08T17:45:46Z',
  updated_at: '2026-01-31T22:28:17Z'
}

### user/emails permissions
This api call and permissions request for github is as of now too invasive as we get access to the user's private emails.

https://api.github.com/user/emails 
[
  {
    "email": "139005538+catdev42@users.noreply.github.com",
    "primary": false,
    "verified": true,
    "visibility": null
  },
  {
    "email": "user@student.42berlin.de",
    "primary": true,
    "verified": true,
    "visibility": "private"
  },
  {
    "email": "johndoe@gmail.com",
    "primary": false,
    "verified": true,
    "visibility": null
  }
]

TODO: 
2 endpoints needed:
- one to redirect to a provider url (done)
- one use that we send to provider to redirect to us and discover if they are verified

## 21.02.26 - Feb 21

### What is a cookie
- a cookie is a key value pair that the browser stores in association with a website and sends automatically with every request
- things can be stored in local storage as well, but that is not sent automaticlaly by the browser


22.02/26

- **Composite Unique Contraint**
  - add [unique('provider_p_id').on(table.provider, table.provider_id)] as third argument to pgTable

- ~~TODO: "dev": "pnpm db:push && tsx watch src/index.ts"~~
- Add to package.json: `"dev": "pnpm db:generate && tsx watch src/index.ts`
  - This is for development only!
  - In production we will add the migration file to the server, it is source of truth

## Note: migration files and their usage
- They function as the source of truth as we work with an existing database. We must track all changes because otherwise the db might assume we deleted one table and added another one...

- How does the migration keep track of the fact that we Altered the column instead of deleting it and putting a new one???? Ddo we write that command? So we don't simply change the schema in schema.ts???




