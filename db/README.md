## Build

```bash
export CR_PAT=<personal access token>
echo $CR_PAT | docker login ghcr.io -u darrylcauldwell --password-stdin        
docker buildx build --platform linux/amd64,linux/arm64 . --tag ghcr.io/darrylcauldwell/evm-db:latest --push

docker pull ghcr.io/darrylcauldwell/evm-db:latest

docker run --name evm-db -d -p 27017:27017 ghcr.io/darrylcauldwell/evm-db:latest
```