## Nginx Requirements for Prototype

### Role

Nginx acts as the **reverse proxy** - the single entry point for all traffic. It routes requests to the correct microservice based on the URL path.

### Why "Reverse" Proxy?

| Regular Proxy                   | Reverse Proxy                   |
| ------------------------------- | ------------------------------- |
| Hides the **user** from servers | Hides the **servers** from user |
| User → Proxy → Internet         | Internet → Proxy → Services     |

### The Problem

An origin = **protocol + host + port**

```
http://localhost:5173
  ↓        ↓       ↓
protocol  host    port
```

**Without nginx - different HOSTS/PORTS:**

```
http://localhost:5173/...
http://localhost:3000/...
http://localhost:3001/...
       ↓
   different origins
```

**With nginx - same HOST, different PATHS:**

```
http://localhost/
http://localhost/api/auth
http://localhost/api/notes
       ↓
   same origin, just different paths
```

User and browser only see `localhost`. Nginx figures out where to send each request.

Why Same Origin Matters

### 1. Browser Security (CORS)

#### The Problem CORS Solves

Imagine you're logged into your bank:

```
1. You visit evil-website.com
2. Evil site runs JavaScript:
   fetch('https://yourbank.com/transfer?to=hacker&amount=1000')
3. Your browser has your bank cookies...
4. Money gone!
```

This is called **Cross-Site Request Forgery (CSRF)**.

#### The Browser's Solution

Browser has a rule: **JavaScript can only fetch from its own origin by default.**

```
You're on:          evil-website.com
JS tries to fetch:  yourbank.com
Browser:            "Different origin. BLOCKED."
```

This protects users.

Browser allows this:

```
Page loaded from:     localhost
Trying to fetch from: localhost/api/notes
→ OK (same origin)
```

### 2. How This Affects Your App

Your frontend loads from `localhost:5173` (Vite dev server).

```javascript
// Frontend code tries to call notes service
fetch('http://localhost:3000/notes')
```

Browser thinks:

```
Page origin:    http://localhost:5173
Request to:     http://localhost:3000
                        ↓
                  different port!

"Could be malicious. BLOCKED."
```

Browser doesn't know these are both YOUR services. It just sees different origins.

---

### Solutions

**Option 1: Configure CORS headers (without nginx)**

Tell notes service: "requests from localhost:5173 are okay"

```rust
// In your notes service
Access-Control-Allow-Origin: http://localhost:5173
```

Problems:

- Every service needs this config
- Different settings for dev vs production
- Easy to misconfigure

**Option 2: Same origin with nginx**

Everything served from one origin:

```
nginx (localhost:80)
  ├── /           → frontend
  └── /api/notes  → notes service
```

### 3. Simpler Frontend Code

Without nginx:

```javascript
fetch('http://localhost:3000/notes')  // which port was it again?
fetch('http://localhost:3001/login')  // need to track all ports
```

With nginx:

```javascript
fetch('/api/notes')   // just use paths
fetch('/api/auth')    // same base, always 
```

### What Nginx Does

Nginx is like a **receptionist** at a building entrance.

```
User only knows one door: localhost:80
                ↓
            [ NGINX ]
           /    |    \
          ↓     ↓     ↓
     frontend notes  auth
```

User visits `localhost/api/notes` → Nginx says *"notes? that's room 3000"* → forwards the request.

### What Nginx Gives You

| Benefit              | Explanation                                                     |
| -------------------- | --------------------------------------------------------------- |
| **CORS**             | Same origin = no browser blocking                               |
| **Simpler frontend** | Just use `/api/...` paths                                       |
| **Security**         | Only port 80 exposed. Internal ports hidden from internet       |
| **SSL/HTTPS**        | Configure certificates in ONE place, not every service          |
| **Logging**          | All traffic logged in one place                                 |
| **Rate limiting**    | Block spam/attacks at the door                                  |
| **Load balancing**   | If you run 3 copies of notes service, nginx distributes traffic |
| **Flexibility**      | Swap services without users noticing                            |

---

## 
