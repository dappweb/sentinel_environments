"""Read-only Robinhood Chain integration primitives.

This module intentionally does not contain transaction signing or write
capabilities.  Milestone 1 only provides:

* network configuration for Robinhood Chain mainnet/testnet;
* JSON-RPC health checks;
* Robinhood's read-only Stock Token API access;
* a small, bounded in-memory cache for public metadata.

Secrets must stay in environment variables.  In particular, an RPC provider
URL may contain a credential and is never returned by the public config
payload or included in exception messages.
"""

from __future__ import annotations

import os
import json
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional
from urllib.parse import urlsplit, urlunsplit

import requests


class RobinhoodChainError(RuntimeError):
    """An upstream Robinhood Chain or Stock Token API request failed."""


NETWORKS: dict[str, dict[str, Any]] = {
    "testnet": {
        "chain_id": 46630,
        "rpc_url": "https://rpc.testnet.chain.robinhood.com",
        "explorer_url": "https://explorer.testnet.chain.robinhood.com",
    },
    "mainnet": {
        "chain_id": 4663,
        "rpc_url": "https://rpc.mainnet.chain.robinhood.com",
        "explorer_url": "https://robinhoodchain.blockscout.com",
    },
}

DEFAULT_ASSET_API_URL = "https://api.robinhood.com/rhj"
DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_METADATA_TTL_SECONDS = 15.0

# ERC-20 decimals and Robinhood's ERC-8056 scaled UI multiplier selectors.
# Keeping these selectors local avoids adding a write-capable Web3 dependency
# to the read-only server boundary.
_DECIMALS_SELECTOR = "0x313ce567"
_UI_MULTIPLIER_SELECTOR = "0xa60bf13d"
_LATEST_ROUND_DATA_SELECTOR = "0xfeaf968c"


def _network_name(value: Optional[str]) -> str:
    name = (value or "testnet").strip().lower()
    if name not in NETWORKS:
        allowed = ", ".join(sorted(NETWORKS))
        raise ValueError(f"ROBINHOOD_CHAIN_NETWORK must be one of: {allowed}")
    return name


def _redacted_url(value: str, *, keep_path: bool = True) -> str:
    """Return a URL without credentials, query, fragment, or unsafe path data."""
    parts = urlsplit(value)
    if not parts.scheme or not parts.netloc:
        return "<configured>"
    host = parts.hostname or "<configured>"
    if parts.port:
        host = f"{host}:{parts.port}"
    path = parts.path if keep_path else ""
    return urlunsplit((parts.scheme, host, path, "", ""))


def _normalise_feed_config(raw: str) -> dict[str, dict[str, Any]]:
    """Parse an optional symbol -> Chainlink feed configuration map.

    The official feed registry is intentionally not copied into source. Feed
    addresses and heartbeat parameters are operator configuration, and must be
    refreshed from the current Chainlink/Robinhood registries before use.
    """
    if not raw.strip():
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("ROBINHOOD_CHAIN_PRICE_FEEDS_JSON must be valid JSON") from exc
    if not isinstance(value, dict):
        raise ValueError("ROBINHOOD_CHAIN_PRICE_FEEDS_JSON must be an object")

    result: dict[str, dict[str, Any]] = {}
    for symbol, entry in value.items():
        key = str(symbol).strip().upper()
        if not key:
            raise ValueError("price feed symbols must not be empty")
        if isinstance(entry, str):
            address = entry
            heartbeat = None
        elif isinstance(entry, dict):
            address = entry.get("address")
            heartbeat = entry.get("heartbeat_seconds")
        else:
            raise ValueError(f"invalid price feed config for {key}")
        if not isinstance(address, str) or not address.startswith("0x") or len(address) != 42:
            raise ValueError(f"invalid price feed address for {key}")
        if heartbeat is not None and (not isinstance(heartbeat, (int, float)) or heartbeat <= 0):
            raise ValueError(f"invalid heartbeat_seconds for {key}")
        result[key] = {
            "address": address,
            "heartbeat_seconds": heartbeat,
        }
    return result


@dataclass(frozen=True)
class RobinhoodChainConfig:
    network: str
    chain_id: int
    rpc_url: str
    explorer_url: str
    asset_api_url: str
    timeout_seconds: float
    metadata_ttl_seconds: float
    price_feeds: dict[str, dict[str, Any]]
    writes_enabled: bool = False

    @classmethod
    def from_env(cls) -> "RobinhoodChainConfig":
        network = _network_name(os.getenv("ROBINHOOD_CHAIN_NETWORK"))
        defaults = NETWORKS[network]
        timeout = float(
            os.getenv(
                "ROBINHOOD_CHAIN_REQUEST_TIMEOUT_SECONDS",
                str(DEFAULT_TIMEOUT_SECONDS),
            )
        )
        ttl = float(
            os.getenv(
                "ROBINHOOD_CHAIN_METADATA_TTL_SECONDS",
                str(DEFAULT_METADATA_TTL_SECONDS),
            )
        )
        if timeout <= 0 or ttl < 0:
            raise ValueError("Robinhood Chain timeout must be positive and TTL non-negative")

        # Writes are deliberately hard-disabled in Milestone 1.  A later
        # milestone must introduce an explicit, separately reviewed execution
        # mode rather than enabling writes through an incidental env var.
        return cls(
            network=network,
            chain_id=int(defaults["chain_id"]),
            rpc_url=os.getenv("ROBINHOOD_CHAIN_RPC_URL", str(defaults["rpc_url"])),
            explorer_url=str(defaults["explorer_url"]),
            asset_api_url=os.getenv("ROBINHOOD_CHAIN_ASSET_API_URL", DEFAULT_ASSET_API_URL).rstrip("/"),
            timeout_seconds=timeout,
            metadata_ttl_seconds=ttl,
            price_feeds=_normalise_feed_config(
                os.getenv("ROBINHOOD_CHAIN_PRICE_FEEDS_JSON", "")
            ),
            writes_enabled=False,
        )

    def public_dict(self) -> dict[str, Any]:
        """Return safe configuration for UI/diagnostics; never expose secrets."""
        return {
            "network": self.network,
            "chain_id": self.chain_id,
            # Provider URLs commonly put API keys in the path, so expose only
            # the origin for RPC diagnostics.
            "rpc_url": _redacted_url(self.rpc_url, keep_path=False),
            "explorer_url": self.explorer_url,
            "asset_api_url": _redacted_url(self.asset_api_url),
            "price_feeds_configured": len(self.price_feeds),
            "mode": "read-only",
            "writes_enabled": self.writes_enabled,
            "supported_operations": [
                "rpc_health",
                "stock_token_assets",
                "stock_token_prices",
                "corporate_actions",
            ],
        }


class RobinhoodChainClient:
    """Small read-only client used by the FastAPI diagnostics endpoints."""

    def __init__(
        self,
        config: Optional[RobinhoodChainConfig] = None,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.config = config or RobinhoodChainConfig.from_env()
        self.session = session or requests.Session()
        self._assets_cache: Optional[tuple[float, dict[str, Any]]] = None

    def _get_json(self, url: str, *, params: Optional[dict[str, str]] = None) -> dict[str, Any]:
        try:
            response = self.session.get(
                url,
                params=params,
                timeout=self.config.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            raise RobinhoodChainError("Robinhood read-only HTTP request failed") from exc
        except ValueError as exc:
            raise RobinhoodChainError("Robinhood read-only API returned invalid JSON") from exc
        if not isinstance(payload, dict):
            raise RobinhoodChainError("Robinhood read-only API returned an invalid payload")
        return payload

    def _rpc(self, method: str, params: Optional[list[Any]] = None) -> Any:
        body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}
        try:
            response = self.session.post(
                self.config.rpc_url,
                json=body,
                timeout=self.config.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            raise RobinhoodChainError("Robinhood Chain RPC request failed") from exc
        except ValueError as exc:
            raise RobinhoodChainError("Robinhood Chain RPC returned invalid JSON") from exc
        if not isinstance(payload, dict):
            raise RobinhoodChainError("Robinhood Chain RPC returned an invalid payload")
        if payload.get("error"):
            raise RobinhoodChainError("Robinhood Chain RPC returned an error")
        if "result" not in payload:
            raise RobinhoodChainError("Robinhood Chain RPC response had no result")
        return payload["result"]

    def health(self) -> dict[str, Any]:
        started = time.perf_counter()
        actual_chain_hex = self._rpc("eth_chainId")
        head_block_hex = self._rpc("eth_blockNumber")
        try:
            actual_chain_id = int(str(actual_chain_hex), 16)
            head_block = int(str(head_block_hex), 16)
        except (TypeError, ValueError) as exc:
            raise RobinhoodChainError("Robinhood Chain RPC returned invalid block metadata") from exc
        return {
            "network": self.config.network,
            "expected_chain_id": self.config.chain_id,
            "actual_chain_id": actual_chain_id,
            "chain_id_matches": actual_chain_id == self.config.chain_id,
            "head_block": head_block,
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            "read_only": True,
        }

    def assets(self, symbol: Optional[str] = None) -> dict[str, Any]:
        now = time.monotonic()
        if (
            self._assets_cache is None
            or now - self._assets_cache[0] >= self.config.metadata_ttl_seconds
        ):
            payload = self._get_json(f"{self.config.asset_api_url}/assets")
            self._assets_cache = (now, payload)
        else:
            payload = self._assets_cache[1]

        if not symbol:
            return payload
        wanted = symbol.strip().upper()
        assets = payload.get("assets", [])
        if not isinstance(assets, list):
            raise RobinhoodChainError("Robinhood asset API returned invalid assets")
        return {
            "assets": [
                asset
                for asset in assets
                if isinstance(asset, dict)
                and str(asset.get("tokenSymbol", "")).upper() == wanted
            ]
        }

    def prices(self, symbol: str) -> dict[str, Any]:
        wanted = symbol.strip().upper()
        if not wanted:
            raise ValueError("symbol must not be empty")
        return self._get_json(f"{self.config.asset_api_url}/prices/{wanted}")

    def corporate_actions(self) -> dict[str, Any]:
        return self._get_json(f"{self.config.asset_api_url}/corporate-actions")

    def _eth_call_int(self, address: str, selector: str) -> int:
        result = self._rpc(
            "eth_call",
            [{"to": address, "data": selector}, "latest"],
        )
        if not isinstance(result, str) or not result.startswith("0x"):
            raise RobinhoodChainError("Robinhood Chain eth_call returned invalid data")
        try:
            return int(result, 16)
        except ValueError as exc:
            raise RobinhoodChainError("Robinhood Chain eth_call returned invalid integer data") from exc

    def _validate_price_feed(self, symbol: str) -> dict[str, Any]:
        feed = self.config.price_feeds.get(symbol)
        if feed is None:
            return {
                "status": "unconfigured",
                "valid": False,
                "reason": "no Chainlink feed configured for this symbol",
            }

        address = feed["address"]
        code = self._rpc("eth_getCode", [address, "latest"])
        if not isinstance(code, str) or code in ("0x", "0x0"):
            return {
                "status": "invalid",
                "valid": False,
                "reason": "configured feed has no contract code",
                "address": address,
            }

        decimals = self._eth_call_int(address, _DECIMALS_SELECTOR)
        raw_round = self._rpc(
            "eth_call",
            [{"to": address, "data": _LATEST_ROUND_DATA_SELECTOR}, "latest"],
        )
        if not isinstance(raw_round, str) or not raw_round.startswith("0x"):
            raise RobinhoodChainError("Chainlink feed returned invalid round data")
        encoded = raw_round[2:]
        if len(encoded) < 64 * 5:
            raise RobinhoodChainError("Chainlink feed returned incomplete round data")
        try:
            words = [int(encoded[i : i + 64], 16) for i in range(0, 64 * 5, 64)]
        except ValueError as exc:
            raise RobinhoodChainError("Chainlink feed returned invalid round data") from exc
        answer = words[1]
        updated_at = words[3]
        heartbeat = feed.get("heartbeat_seconds")
        now = int(time.time())
        stale = updated_at <= 0 or (
            heartbeat is not None and now - updated_at > float(heartbeat)
        )
        return {
            "status": "stale" if stale else "valid",
            "valid": answer > 0 and not stale,
            "address": address,
            "decimals": decimals,
            "answer": str(answer),
            "updated_at": updated_at,
            "heartbeat_seconds": heartbeat,
            "age_seconds": max(0, now - updated_at) if updated_at else None,
        }

    def asset_config(self, symbol: str) -> dict[str, Any]:
        """Resolve and validate one canonical asset on the configured chain."""
        wanted = symbol.strip().upper()
        if not wanted:
            raise ValueError("symbol must not be empty")
        payload = self.assets(wanted)
        assets = payload.get("assets", [])
        if not assets:
            return {
                "symbol": wanted,
                "supported": False,
                "reason": "symbol is not present in the official Stock Token registry",
                "network": self.config.network,
                "chain_id": self.config.chain_id,
            }

        asset = assets[0]
        deployments = asset.get("deployments", [])
        deployment = next(
            (
                item
                for item in deployments
                if isinstance(item, dict)
                and int(item.get("chainId", -1)) == self.config.chain_id
            ),
            None,
        )
        result: dict[str, Any] = {
            "symbol": wanted,
            "network": self.config.network,
            "chain_id": self.config.chain_id,
            "asset_status": asset.get("status"),
            "official_asset_id": asset.get("id"),
            "token_name": asset.get("tokenName"),
            "api_current_multiplier": asset.get("currentMultiplier"),
            "pending_multiplier": asset.get("pendingMultiplier", ""),
            "trading_capabilities": asset.get("tradingCapabilities"),
            "supported": deployment is not None,
            "deployment": deployment,
            "price_feed": (
                self._validate_price_feed(wanted)
                if deployment is not None
                else {
                    "status": "not_applicable",
                    "valid": False,
                    "reason": "asset has no deployment on the configured chain",
                }
            ),
        }
        if deployment is None:
            result["reason"] = "official asset has no deployment on the configured chain"
            return result

        token_address = deployment.get("contractAddress")
        if not isinstance(token_address, str):
            result["supported"] = False
            result["reason"] = "official deployment has no token address"
            return result
        code = self._rpc("eth_getCode", [token_address, "latest"])
        code_present = isinstance(code, str) and code not in ("0x", "0x0")
        result["token_contract"] = {
            "address": token_address,
            "code_present": code_present,
        }
        if not code_present:
            result["supported"] = False
            result["reason"] = "official token address has no contract code on the configured chain"
            return result

        onchain_decimals = self._eth_call_int(token_address, _DECIMALS_SELECTOR)
        onchain_multiplier = self._eth_call_int(token_address, _UI_MULTIPLIER_SELECTOR)
        result["token_contract"].update(
            {
                "decimals": onchain_decimals,
                "ui_multiplier": str(onchain_multiplier),
                "api_multiplier_matches_onchain": str(onchain_multiplier)
                == str(int(Decimal(str(asset.get("currentMultiplier", "0"))) * 10**18)),
            }
        )
        return result


_client: Optional[RobinhoodChainClient] = None


def get_robinhood_chain_client() -> RobinhoodChainClient:
    global _client
    if _client is None:
        _client = RobinhoodChainClient()
    return _client


def reset_robinhood_chain_client() -> None:
    """Reset the process-local client for tests and controlled reconfiguration."""
    global _client
    _client = None
