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
import time
from dataclasses import dataclass
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


@dataclass(frozen=True)
class RobinhoodChainConfig:
    network: str
    chain_id: int
    rpc_url: str
    explorer_url: str
    asset_api_url: str
    timeout_seconds: float
    metadata_ttl_seconds: float
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
