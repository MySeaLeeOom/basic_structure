# NGINX Service

## Config

``` nginx
server {
    listen 80;

    resolver 127.0.0.11 valid=10s;
	# without this nginx will look for the ip address of a container only once, at startup 
	# 127.0.0.11 is Docker network address with DNS lookup

    # API routes (secure)
    location /api/notes {
        # 1. THE BOUNCER: Intercept request and ask Auth Service if user is okay
        auth_request /api/auth/verify;
        error_page 401 = @login;

        # 2. THE EXTRACTION: Catch identity from Auth Service's response headers
        # 'upstream_http_' is how Nginx reads headers from internal sub-requests
        auth_request_set $auth_user_id $upstream_http_x_user_id;
        auth_request_set $auth_user_role $upstream_http_x_user_role;

        # 3. THE INJECTOR: Overwrite headers sent to the Notes Service
        # Even if a user tries to spoof these in their browser, Nginx 
        # overwrites them here with our internal, VERIFIED data.
        proxy_set_header X-User-Id $auth_user_id;
        proxy_set_header X-User-Role $auth_user_role;

        proxy_pass http://notes:3003;
    }

	# Preparing for when we have auth, to know what we need to get correct notes
	# X-User-ID: 42
    # X-User-Role: admin
    # X-User-Status: active

    location /api/auth {
		set $auth_upstream auth:3000; 
		#Creates a variable for the service location, 
		#Doesn't crash nginx is service not yet ready

		rewrite ^/api/auth/(.*) /$1 break;
		#removes /api/auth/ and leaves what is after such as /login/github
        proxy_pass http://$auth_upstream;
		#use the service url in variable

		proxy_set_header Host $host; 
		#By default, Nginx sets the Host header of the outgoing request to the name of the proxy_pass directive.
		#This may fail and may require $http_host. This keeps the URL of the site, instead of overwriting it. $http_host will keep also the port.

		proxy_set_header X-Real-IP $remote_addr; 
		#Your Auth service sees the "Last Hop" IP (Nginx). If someone tries to brute-force a password, you want to ban their IP, not Nginx's IP.

		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
		#Similar job as remote_addr but entire chain of custody
	}

	# Frontend server
    location / {
        set $frontend_upstream frontend:3000;
        proxy_pass http://$frontend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Resolver purpose

1. The Startup Crash (Static Mode)
If you use proxy_pass http://auth:3000; (no variables):

The Fact: Nginx tries to "verify its world" before it opens its doors.
The Event: If the auth container is not yet "Born" (started), Nginx says: "My world is broken! I cannot find 'auth' in the phonebook!" and it exits with an error.
The Cycle: If Docker has restart: always, it will indeed keep killing and restarting Nginx in a loop until auth finally appears. This is valid logic, but it is Brute Force.

2. The Runtime 502 (Static Mode)
If Nginx starts successfully (because auth was up), but then auth goes down later:

The Fact: Nginx does not crash.
The Problem: It keeps trying to send traffic to the Old IP it learned during startup. Since that IP is now a "ghost," you get a 502 Bad Gateway.
The Failure: Even if auth restarts and gets a New IP, Nginx will never know. You must manually restart Nginx to force it to look at the phonebook again.

3. The "Dependency Loop" Hazard
Relying on "Crash and Restart" is dangerous for Structural Stability.

Imagine a complex system:

Nginx depends on Auth.
Auth depends on Postgres.
Postgres takes 20 seconds to boot up.
Without the resolver, Nginx will crash-restart 10 times while waiting for Postgres to be ready for Auth. In a large system, this "Thundering Herd" of restarting containers can overwhelm your CPU and memory, sometimes preventing anything from ever successfully starting.

