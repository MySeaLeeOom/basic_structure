# notes specific add ons

Dockerfile, .dockerignoere, entrypoint.sh are not diffrent. So I ignore.

## Dependecies (Cargo.toml)
+ Web Framework: To handle HTTP requests (axum).  
+ (Async Runtime: requiered for axum(tokio))
+ The Serializer - to understand JSON(serde)
+ (JSON tools (serde_json))
+ ...

## src/
### main
start server and call func pretty basic
### Define what a "Note" looks like in our system. (models.rs)
What to do: Create a public struct Note.
+ id: String (Unique ID).
+ title: String.
+ content: String.

### define url connections (router.rs)
+ GET /notes -> calls Get function.
+ POST /notes -> calls Post function.

### API Endpoints (handler.rs)

#### GET /notes  

+ lock the shared memory list. (philos)
+ Clone the data.
+ Return it as a JSON Array.

#### POST /notes

+ Generate a unique ID.
+ Create a new Note object.
+ Lock the shared memory list.
+ Push the new note into the list.
+ Return the saved note as JSON.

### activate RAM (state.rs)
Kind of the handler of to many requests. So for example a bunch of users try to use the POST request at the same time. <- Problem So:
+ safe all the request (ARC does that, it gives each user a refrence to a memory location)
+ than the philos problem (using Mutex finish them one after another)

## rust-notes specific:
```
services/notes/
├── Cargo.toml
├── Dockerfile
├── .dockerignore
├── (entrypoint.sh)
└── src/
    ├── main.rs
    ├── models.rs
    ├── routers.rs
    ├── handlers.rs
    └── state.rs
```