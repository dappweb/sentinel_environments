import pytest
from fastapi import HTTPException

from server.privy_auth import require_privy_user, verify_privy_token


def test_missing_configuration_fails_closed(monkeypatch):
    monkeypatch.delenv("PRIVY_ISSUER", raising=False)
    with pytest.raises(HTTPException) as exc:
        verify_privy_token("not-a-token")
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_bearer_token_is_required():
    class Request:
        headers = {}

    with pytest.raises(HTTPException) as exc:
        await require_privy_user(Request())
    assert exc.value.status_code == 401
