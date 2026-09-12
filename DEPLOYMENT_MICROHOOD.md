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

### Required `.env` keys

| Key | Purpose |
| --- | --- |
| `ROBINHOOD_CHAIN_NETWORK` | `mainnet` (4663) to resolve the official MSFT Stock Token; on `testnet` (46630) the MSFT endpoint fails closed because the asset has no deployment on that chain |
| `ROBINHOOD_CHAIN_TIMEOUT_SECONDS` | RPC/API timeout for the read-only chain client |
| `ROBINHOOD_CHAIN_PRICE_FEEDS_JSON` | Chainlink feed map, e.g. `{"MSFT": {"address": "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E", "heartbeat_seconds": 86400}}` |
| `VITE_PRIVY_APP_ID` | Privy app id. Inlined into the frontend bundle **at build time**, so changing it requires `up -d --build frontend` |
| `CLOUDFLARE_TUNNEL_TOKEN` | `metakina-prod` tunnel connector token, required by `docker-compose.production.yml` |

The API has no transaction signing or write capability on either network.
Production deployment does not configure a wallet, private key, trade
executor, or real-funds approval.

## Acceptance checks

```bash
curl -fsS https://microhood.ai/ | grep -F "MicroHood"
curl -fsS https://microhood.ai/api/chain/robinhood/config
curl -fsS https://microhood.ai/api/chain/robinhood/asset-config/MSFT
docker compose --env-file /opt/microhood/.env -f docker-compose.production.yml logs --tail=100 cloudflared
```

The rollout is not considered live until the HTTPS homepage, API config, and
Cloudflare connector status are all verified. A successful image build alone
is not deployment proof.
