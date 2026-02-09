## SSR 
Here is a diagram showing how data flows from your database all the way to the user's browser during an SSR request.

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Nginx
    participant F as Frontend (Fastify)
    participant S as Notes API
    participant DB as Postgres
    Note over B, DB: SERVER-SIDE RENDERING PHASE
    B->>N: GET /notes
    N->>F: Proxy request
    F->>F: entry-server.ts: render(url)
    
    rect rgb(240, 240, 240)
    Note right of F: onServerPrefetch()
    F->>S: GET http://notes:8000/api/notes
    S->>DB: SQL Query
    DB-->>S: Rows
    S-->>F: JSON Data (Array of Notes)
    Note right of F: Pinia Store Populated
    end
    F->>F: Serialize Pinia State to window.__INITIAL_STATE__
    F->>N: Return HTML + Injected State
    N->>B: Final HTML Response
    Note over B: Page is visible to user immediately
    Note over B, DB: CLIENT-SIDE HYDRATION PHASE
    B->>B: entry-client.ts executes
    B->>B: Hydrate Pinia: store.state = window.__INITIAL_STATE__
    Note right of B: Vue "takes over" the page
    
    B->>B: NotesView: onMounted()
    Note right of B: Checks store.notes (not empty, skips fetch)
```

### Key Technical Details in your flow:

1.  **The "Shortcut"**: In the diagram, notice the Frontend talks directly to the **Notes API** over the internal Docker network (`http://notes:8000`). This is fast and secure because it never leaves the "internal network."
2.  **The Serialization**: We convert the Pinia data into a string and put it in a `<script>` tag. This is how the server "hands the baton" to the browser.
3.  **The Hydration**: When the browser loads the JavaScript, it checks that script tag. If the data is there, Pinia fills it up instantly. This prevents that annoying flicker where a list is empty for half a second before loading.
4.  **`onServerPrefetch`**: This is the "magic" hook that forces the server to pause and wait for the database results before it is allowed to finish rendering the HTML.