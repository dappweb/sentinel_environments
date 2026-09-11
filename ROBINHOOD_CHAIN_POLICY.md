# Robinhood Chain Agent policy milestone

This milestone adds a non-upgradeable `AgentPolicy` contract. It is a policy
boundary for a user's ERC-4337 smart account or policy module; it does not
custody assets and cannot execute arbitrary external calls by itself.

## Controls

Each session key has:

- an expiry window;
- an allowlist of target contracts;
- an allowlist of function selectors;
- native ETH per-call and per-day limits;
- per-asset per-call and per-day limits;
- owner revocation;
- guardian emergency revocation and pause.

The policy's `executor` is the only address allowed to consume a call budget.
The eventual smart-account adapter must call `consumeCall` before dispatching
the exact, separately checked call. The policy contract deliberately does not
perform arbitrary `call`, token transfers, approvals, swaps, bridges, or
transactions.

## Intended integration

```text
User Smart Account
  -> validates Agent Session Key
  -> calls AgentPolicy.consumeCall(...)
  -> dispatches only the same target/selector/asset/amount
```

The next milestone must bind this policy to one selected ERC-4337 account
implementation and prove that a session key cannot bypass the policy through a
different execution path. Until then, this contract is not a complete trading
wallet and must not be deployed with user funds.

Run the isolated contract tests with:

```bash
forge test --root contracts
```
