# Docker Setup Commands (macOS)

Use this when `make` fails with:
- `docker: No such file or directory`
- `docker-credential-desktop: executable file not found in $PATH`

## 1) Check Docker CLI availability

```bash
which docker
docker --version
docker compose version
```

## 2) Check Docker config and credential store

```bash
ls -la ~/.docker
python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.docker/config.json")
print(open(p).read())
PY
```

Expected config contains:
- `"credsStore": "desktop"`

## 3) Confirm Docker Desktop app and bundled binaries exist

```bash
ls -la /Applications
ls -la "/Applications/Docker.app/Contents/Resources/bin"
ls -la /usr/local/bin
```

## 4) Fix missing credential helper binaries (one-time)

```bash
ln -sf "/Applications/Docker.app/Contents/Resources/bin/docker-credential-desktop" /usr/local/bin/docker-credential-desktop
ln -sf "/Applications/Docker.app/Contents/Resources/bin/docker-credential-osxkeychain" /usr/local/bin/docker-credential-osxkeychain
ls -la /usr/local/bin/docker-credential-desktop /usr/local/bin/docker-credential-osxkeychain
```

## 5) Refresh shell command cache and verify

```bash
hash -r
which docker
docker --version
docker compose version
docker-credential-desktop version
```

## 6) Start project

```bash
make
```

If `which docker` is still empty in your current tab, restart that terminal tab (or run `exec zsh`) and retry.
