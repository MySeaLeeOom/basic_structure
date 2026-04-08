```
gateway       | the service is: /api/notes
gateway       |   body: b'{"title":"123","content":"123"}'
gateway       |   headers: {'host': 'gateway:8001', 'connection': 'close', 'content-length': '31', 'sec-ch-ua-platform': '"macOS"', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', 'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"', 'dnt': '1', 'content-type': 'application/json', 'sec-ch-ua-mobile': '?0', 'accept': '*/*', 'origin': 'http://localhost:8080', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty', 'referer': 'http://localhost:8080/notes', 'accept-encoding': 'gzip, deflate, br, zstd', 'accept-language': 'en-UK,en;q=0.9,ru-RU;q=0.8,ru;q=0.7,de;q=0.6'}
gateway       |   method: POST
gateway       |   query_params: {}
gateway       |   upstream: http://notes:3003/api/notes
gateway       |   path: api/notes
gateway       | -> reponse: <Response [404 Not Found]>
gateway       | INFO:     172.18.0.3:58306 - "POST /api/notes HTTP/1.0" 404 Not Found
nginx         | 2026/02/04 18:43:11 [warn] 21#21: *60 upstream sent duplicate header line: "date: Wed, 04 Feb 2026 18:43:11 GMT", previous value: "date: Wed, 04 Feb 2026 18:43:11 GMT", ignored while reading response header from upstream, client: 192.168.65.1, server: , request: "POST /api/notes HTTP/1.1", upstream: "http://172.18.0.2:8001/api/notes", host: "localhost:8080", referrer: "http://localhost:8080/notes"
nginx         | 192.168.65.1 - - [04/Feb/2026:18:43:11 +0000] "POST /api/notes HTTP/1.1" 404 0 "http://localhost:8080/notes" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36" "-"
```

