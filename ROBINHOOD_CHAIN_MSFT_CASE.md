# MSFT on Robinhood Chain: case study

This project uses the official Robinhood `MSFT` Stock Token as the concrete
Robinhood Chain case. The benchmark's MicroHood UI remains a deterministic
simulation for agent-evaluation tasks; this integration adds a separate,
read-only chain boundary for resolving and validating the real public asset.

## Verified asset boundary

The following values were read from Robinhood's public Stock Token API and the
Robinhood Chain mainnet RPC on 2026-09-12:

| Field | Observed value |
| --- | --- |
| Symbol | `MSFT` |
| Token name | `Microsoft • Robinhood Token` |
| Status | `ASSET_STATUS_ACTIVE` |
| Chain | Robinhood Chain mainnet, chain ID `4663` |
| Canonical contract | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` |
| Token decimals | `18` |
| API current multiplier | `1.000412952576205964` |
| On-chain `uiMultiplier()` | `1000412952576205964` |
| API/on-chain multiplier check | `true` |
| Price-feed readiness | Chainlink `Robinhood MSFT / USD` feed proxy `0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E` (8 decimals, heartbeat `86400`s) |

The canonical asset registry is authoritative for the official Stock Token
deployment. A different contract address with the same ticker must not be
presented as the official MSFT Stock Token.

## Agent workflow

```text
MicroHood monitoring task
  -> resolve MSFT in /rhj/assets
  -> select the deployment whose chainId is 4663
  -> verify bytecode, decimals, and uiMultiplier() through RPC
  -> read quotes/corporate actions
  -> wait for the benchmark condition and report
```

The current milestone stops at public reads. It does not connect a wallet,
sign a transaction, submit a UserOperation, place an order, bridge assets, or
claim that the project token is Microsoft equity.

## The supplied project CA

The address supplied for display on the homepage is:

```text
0x6be1478173ccb95e31d8b22b0b71efde24e2f0c4
```

It is displayed as the Microhood project token CA and is intentionally labeled
separately from the official MSFT Stock Token above. It must not be substituted
into the official asset registry or described as a Robinhood-issued Microsoft
stock token without independent authoritative evidence.

## Local verification

Use mainnet only for read-only diagnostics when reproducing the case locally:

```bash
ROBINHOOD_CHAIN_NETWORK=mainnet \
  .venv/bin/python -m uvicorn server.server:app --host 127.0.0.1 --port 8000

curl http://127.0.0.1:8000/chain/robinhood/asset-config/MSFT
```

The default local configuration remains testnet and write-disabled. On testnet,
the endpoint fails closed when the official MSFT deployment is not present on
that chain.

Authoritative references:

- [Robinhood Chain documentation](https://docs.robinhood.com/chain/)
- [Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis)
- [Token contracts](https://docs.robinhood.com/chain/contracts)
- [Robinhood Chain price feeds (Chainlink)](https://docs.chain.link/data-feeds/price-feeds/addresses?network=robinhood)
