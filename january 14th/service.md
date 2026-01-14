## generic structure
```Plaintext
services/[service_name]/
├── [dependencies]
├── Dockerfile
├── .dockerignore
├── entrypoint.sh
└── src/
    ├── main.[x]
    └── [logic]
```
### Dependencies 
e.g. Cargo.toml(rust), requirements.txt(python), package.json(frontend).  
What is needed to build the app (libaries,...).

### Dockerfile
Two things. In Inception we only set up the system and call the entrypoint.sh.  
Here we also set up the app, first large Container:
```Dockerfile
FROM [Language_Official_Image] as builder

WORKDIR /app

COPY [dependencies_file] .
# note for the future: Lock_files
RUN [Command_To_Download_Dependencies]

COPY src ./src
RUN [Command_To_Compile_Or_Package]
```
Forget first container and creating a new one - basics from inception (in the same Dockerfile).  
("Forget" means only safe a snapshot of the image)
```Dockerfile
FROM [Minimal_OS_Image]

WORKDIR /app

RUN [Install_System_Libraries]

# we grab the executable from first container
COPY --from=builder /app/[Result_Of_Build] .

EXPOSE [Port_Number]

COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]

CMD ["./[Executable_Name]"]
```
Now there is only the second container. The first one is deleted.  
note im using "WORKDIR" /app to create a kind of safe space inside the container.

### .dockerignore
Faster Build Speed(.git, .venv), Prevents Cache Invalidation(README.md), Security(.env), Smaller Image Size(test data), ...  
target/(rust), node_modules/(frontend),...

### entrypoint.sh
wait for db to load + give control back.  
later with postgres db (before that Im against an entrypoint.sh):
```bash
#!/bin/sh

# loop until netcat is able to connect to db (-z: after nc connects, it makes sure to disconnects)
while ! nc -z [db_name] [port]; do
  sleep 1
done

exec "$@"
```

### src/
The Setup (Main): Start the web server, listen to port and calls func.

The Config: Read variables from the .env file (Database URL, Passwords) .

The Data Model: Define what your data looks like in the db (e.g., struct User or class Note).

The Router: Define the URLs (e.g., GET /notes, POST /login).

The Handlers: The actual functions(GET, ...) that run when a URL is hit (receive JSON -> do logic -> return JSON).

The Add ons: Service-specific extras
