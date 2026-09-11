# MicroHood deployment

The production shape for `microhood.ai` is:

```text
Cloudflare DNS / Tunnel
          |
          v
metakina-hostinger
  cloudflared (host network)
          |
       port 80
          |
       Nginx
       /api/* -> FastAPI
       /*     -> Vite static build
```

The deployment uses the existing Cloudflare `metakina-prod` tunnel. The
connector token is a secret and must exist only in the host's untracked
`/opt/microhood/.env` file. The repository contains only the placeholder in
[`.env.example`](.env.example).

## Cloudflare records

The `microhood.ai` zone should contain proxied CNAME records for the apex and
`www`, both targeting the existing tunnel hostname:

```text
microhood.ai      CNAME <metakina-prod-tunnel-id>.cfargotunnel.com
www.microhood.ai  CNAME <metakina-prod-tunnel-id>.cfargotunnel.com
```

The tunnel ingress must include `microhood.ai` and `www.microhood.ai` before
the DNS records are enabled, both pointing to `http://127.0.0.1:80`. The
existing tunnel already uses this origin shape for the `metakina.com` routes.

## Host deployment

On `metakina-hostinger`, from the checked-out release:

```bash
mkdir -p /opt/microhood
cp .env.example /opt/microhood/.env
# Edit /opt/microhood/.env on the host and insert the tunnel token securely.
chmod 600 /opt/microhood/.env
docker compose --env-file /opt/microhood/.env -f docker-compose.production.yml up -d --build
docker compose --env-file /opt/microhood/.env -f docker-compose.production.yml ps
```

The API defaults to Robinhood Chain testnet and has no transaction signing or
write capability. Production deployment does not configure a wallet,
private key, trade executor, or real-funds approval.

## Acceptance checks

```bash
curl -fsS https://microhood.ai/ | grep -F "MicroHood"
curl -fsS https://microhood.ai/api/chain/robinhood/config
docker compose --env-file /opt/microhood/.env -f docker-compose.production.yml logs --tail=100 cloudflared
```

The rollout is not considered live until the HTTPS homepage, API config, and
Cloudflare connector status are all verified. A successful image build alone
is not deployment proof.
