# Robinhood Chain read-only milestone

This milestone adds a deliberately read-only integration boundary. It does
not connect a wallet, sign a transaction, submit a UserOperation, bridge
assets, or enable a mainnet execution path.

## Configuration

The defaults use the public Robinhood Chain testnet RPC and Robinhood's
read-only Stock Token API:

```text
ROBINHOOD_CHAIN_NETWORK=testnet
ROBINHOOD_CHAIN_RPC_URL=https://rpc.testnet.chain.robinhood.com
ROBINHOOD_CHAIN_ASSET_API_URL=https://api.robinhood.com/rhj
# Optional operator-maintained Chainlink feed map. Do not copy stale feed
# addresses into source; refresh it from the current official registry.
ROBINHOOD_CHAIN_PRICE_FEEDS_JSON='{"AAPL":{"address":"0x...","heartbeat_seconds":3600}}'
```

The network can be changed to `mainnet` for read-only diagnostics. A custom
RPC URL may be supplied through `ROBINHOOD_CHAIN_RPC_URL`; it must remain an
environment-only value if it contains a provider credential.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /chain/robinhood/config` | Safe network metadata; secrets are redacted |
| `GET /chain/robinhood/health` | Reads `eth_chainId` and `eth_blockNumber` |
| `GET /chain/robinhood/assets` | Reads canonical Stock Token metadata |
| `GET /chain/robinhood/assets?symbol=AAPL` | Filters the asset metadata response |
| `GET /chain/robinhood/asset-config/AAPL` | Resolves the asset on the configured chain and checks token code/decimals/multiplier |
| `GET /chain/robinhood/prices/AAPL` | Reads the public Stock Token quote |
| `GET /chain/robinhood/corporate-actions` | Reads corporate-action metadata |

The API is intentionally a bounded proxy for known read-only upstreams. It
does not accept arbitrary URLs and it never returns the configured RPC query
string or fragment.

The official asset API may list an asset on mainnet while the configured
testnet has no corresponding deployment. In that case `asset-config` returns
`supported: false` and the integration fails closed. A Chainlink feed is
reported as `unconfigured` until an operator supplies the current feed address
and heartbeat; no feed address is invented or inferred from a ticker.

## Next boundary

The next milestone may add an asset registry snapshot and Chainlink feed
validation. It must keep writes disabled until a separate smart-account,
session-key, policy, and testnet execution review is complete.
