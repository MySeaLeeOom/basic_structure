## Why passwords in secrets?

Commands like ps aux or docker inspect can expose env variables. They are also broadcast to sidecar containers. Secrets remain inside. 

