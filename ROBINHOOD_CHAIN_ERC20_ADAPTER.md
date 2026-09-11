# Robinhood Chain ERC-20 adapter

This milestone adds `AgentErc20Adapter`, a narrow account-module boundary for
the read-only Robinhood Chain integration. It is intentionally not a wallet,
router, swap executor, bridge, or custody contract.

## Supported surface

The adapter constructs exactly two ERC-20 calls:

- `transfer(address,uint256)`
- `approve(address,uint256)`

It does not accept arbitrary calldata and does not expose `permit`, swaps,
bridges, native-value transfers, or token custody. The asset amount is charged
against the session's `AgentPolicy` per-call and daily asset limits.

## Execution boundary

```text
agent session / account authorization
              |
              v
       AgentErc20Adapter
       - account binding
       - fixed ERC-20 calldata
       - policy.consumeCall()
              |
              v
  IAgentExecutionAccount(account)
       - account-owned module authorization
       - executes token call from account balance
              |
              v
           ERC-20 token
```

The adapter requires the calling account to be explicitly bound to the
session key. The `AgentPolicy` executor must be the adapter, and the policy
owner remains the source of authority for account binding. The account module
must authorize the adapter and return the raw target-call success flag and
return data.

Policy consumption happens before the external account-module call. If the
module or token call fails, the transaction reverts and the policy accounting
also rolls back. Standard ERC-20 `false` return data is rejected; no-return
legacy tokens are accepted for compatibility with common deployed tokens.

## Robinhood Chain compatibility

The adapter is chain-agnostic and can target Robinhood Chain ERC-20 contracts,
including the official MSFT Stock Token only after a user-controlled account
module, token allowlist, selector allowlist, and session budget are configured.
The repository's canonical MSFT case remains read-only until that explicit
deployment and authorization step exists.

The supplied project token CA is displayed separately and is not treated as
Microsoft equity or as an official Robinhood Stock Token:

`0x6be1478173ccb95e31d8b22b0b71efde24e2f0c4`

## Deployment checklist

1. Deploy `AgentPolicy(owner, guardian)`.
2. Deploy `AgentErc20Adapter(policy)`.
3. Set the adapter as the policy executor.
4. Configure the session window, token target, exact selectors, and asset limits.
5. Bind the user smart account to the session key in the adapter.
6. Authorize the adapter as a module in the user smart account.
7. Test on Robinhood Chain testnet with a non-production account and no real
   funds before any production authorization.

No deployment, wallet authorization, mainnet trade, or approval is performed
by this repository milestone.
