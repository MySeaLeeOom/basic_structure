# Auth microservice

We have 2 main options:
1. OAuth 2 (= use a third party Identity Provider -IDP- to authenticate users, such as google... even 42 intra)
2. Local accounts (requires setting up a database)

We could of course do both, but i'd imagine it's best to start with one and add the other one later to get the prototype up faster.
OAuth2 with intra sounds like a good idea to me.

## PRELIMINARIES

### Who calls our auth service?
1. the user, when they go to the website and log in, log out, manage their account.
2. the other services from our application

### how does this work?
this is how i understand it:

for logging in:
- the user comes to the application and logs in (with 2rd party IDP or local credentials)
- these credentials are compared against oauth (or our database)
- if correct, the webapp sends a response that includes a **header** which asks the user's browser to set a **cookie** with a certain value.
  - a cookie is basically a text file with a long ass random looking string.
  - the web app stores de value of the cookie somewhere associated with this user, and when we need to check who the user is we compare.

for other parts of our application (the notes):
- the user goes to the "notes" part of the app.
- a request is sent, which "shows" the user's cookie: "hello, this is my ID, show me notes"
- we check his cookie matches a valid, logged in user.
  - if it doesn't, we redirect the user to login screen.
  - if it does, we show them their notes.
- when the user is verified and has their notes available, they might write a new one. when they click save, the "notes part of the app" needs to verify again:
    - notes communicates with auth and says "hey, who is this guy? this is the cookie he showed"
    - auth replies "yeah, that's maarten"
    - notes says "cool" and saves the document to user maarten's notes.

what about anonymous sessions? this would be very nice to have, but... **later**. for now, better only logged in users.
is "asking" the auth every time effcient? i think it's not a problem, but we can look into **cacheing**.
how is NOTES talking to AUTH? **http**.
  - in auth there is an **ENDPOINT** (GET or POST? idk yet)
  - when notes asks, auth sends back some info about the user. possibly a jason (JWT token: jason web token). in this json we might have username, name, some settings (for instance user's preference for dark or light theme), whatever we need.

## CONCRETE THINGS

In the big docker-compose at the root of the project, two things need to be set up for the auth service:
1. a database, like mariadb in inception
2. the auth thing itself

each of these things needs its own **dockerfile**.
the database also needs a **volume** so that data persists (see inception).

### database
- Dockerfile for database is pretty standard, not unlike the one from inception. will depend on what we want to use (maria? postgres? etc)
- we also need a script to initialize, set up tables, etc.

### auth thing
- Dockerfile: set up an image where the auth_app runs.
- the auth_app has to be written. this can be done in many ways, even with django (just an example!!!)
  - if it is django (for example!!!) the dockerfile would have to install python, install django, etc,
  - then copy all the files (the django project) into the container (like in inception)
  - and then run it


## resources to look into
https://microservices.io/post/architecture/2025/04/25/microservices-authn-authz-part-1-introduction.html (this one looks great)

https://frontegg.com/blog/authentication-in-microservices