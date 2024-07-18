## Build

```bash
export CR_PAT=<personal access token>
echo $CR_PAT | docker login ghcr.io -u darrylcauldwell --password-stdin        
docker buildx build --platform linux/amd64,linux/arm64 . --tag ghcr.io/darrylcauldwell/evm-ui:latest --push

docker pull ghcr.io/darrylcauldwell/evm-ui:latest
docker run --name evm-ui -d -p 4000:5000  ghcr.io/darrylcauldwell/evm-ui:latest
```