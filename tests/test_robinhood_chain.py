"""Tests for the read-only Robinhood Chain integration boundary."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.robinhood_chain import (  # noqa: E402
    RobinhoodChainClient,
    RobinhoodChainConfig,
    RobinhoodChainError,
)


class FakeResponse:
    def __init__(self, payload: object, status_code: int = 200):
        self.payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> object:
        return self.payload


class FakeSession:
    def __init__(self):
        self.get_calls: list[tuple[str, dict]] = []
        self.post_calls: list[tuple[str, dict]] = []

    def get(self, url: str, **kwargs):
        self.get_calls.append((url, kwargs))
        if url.endswith("/assets"):
            return FakeResponse(
                {
                    "assets": [
                        {"tokenSymbol": "AAPL", "status": "ASSET_STATUS_ACTIVE"},
                        {"tokenSymbol": "MSFT", "status": "ASSET_STATUS_ACTIVE"},
                    ]
                }
            )
        if "/prices/" in url:
            return FakeResponse({"quotes": [{"tokenSymbol": url.rsplit("/", 1)[-1]}]})
        if url.endswith("/corporate-actions"):
            return FakeResponse({"corpActions": []})
        raise AssertionError(f"unexpected GET {url}")

    def post(self, url: str, **kwargs):
        self.post_calls.append((url, kwargs))
        method = kwargs["json"]["method"]
        if method == "eth_chainId":
            return FakeResponse({"jsonrpc": "2.0", "id": 1, "result": hex(46630)})
        if method == "eth_blockNumber":
            return FakeResponse({"jsonrpc": "2.0", "id": 1, "result": hex(123)})
        raise AssertionError(f"unexpected RPC method {method}")


def config() -> RobinhoodChainConfig:
    return RobinhoodChainConfig(
        network="testnet",
        chain_id=46630,
        rpc_url="https://rpc.testnet.chain.robinhood.com",
        explorer_url="https://explorer.testnet.chain.robinhood.com",
        asset_api_url="https://api.robinhood.com/rhj",
        timeout_seconds=1,
        metadata_ttl_seconds=60,
        writes_enabled=False,
    )


def test_public_config_is_read_only_and_redacts_rpc_query():
    cfg = config()
    cfg = RobinhoodChainConfig(
        **{**cfg.__dict__, "rpc_url": "https://provider.invalid/v2/secret-key?x=y"}
    )
    public = cfg.public_dict()
    assert public["mode"] == "read-only"
    assert public["writes_enabled"] is False
    assert "secret-key" not in public["rpc_url"]
    assert "x=y" not in public["rpc_url"]


def test_health_verifies_expected_chain_and_block():
    session = FakeSession()
    result = RobinhoodChainClient(config(), session=session).health()
    assert result["actual_chain_id"] == 46630
    assert result["chain_id_matches"] is True
    assert result["head_block"] == 123
    assert result["read_only"] is True
    assert [call[1]["json"]["method"] for call in session.post_calls] == [
        "eth_chainId",
        "eth_blockNumber",
    ]


def test_assets_are_cached_and_symbol_filter_is_case_insensitive():
    session = FakeSession()
    client = RobinhoodChainClient(config(), session=session)
    assert client.assets("aapl")["assets"][0]["tokenSymbol"] == "AAPL"
    assert client.assets("MSFT")["assets"][0]["tokenSymbol"] == "MSFT"
    assert len([call for call in session.get_calls if call[0].endswith("/assets")]) == 1


def test_prices_and_corporate_actions_are_read_only_calls():
    session = FakeSession()
    client = RobinhoodChainClient(config(), session=session)
    assert client.prices("aapl")["quotes"][0]["tokenSymbol"] == "AAPL"
    assert client.corporate_actions() == {"corpActions": []}
    assert not session.post_calls


def test_rpc_error_is_normalized_without_leaking_payload():
    class ErrorSession(FakeSession):
        def post(self, url: str, **kwargs):
            return FakeResponse(
                {"jsonrpc": "2.0", "id": 1, "error": {"message": "secret provider detail"}}
            )

    with pytest.raises(RobinhoodChainError, match="RPC returned an error"):
        RobinhoodChainClient(config(), session=ErrorSession()).health()
