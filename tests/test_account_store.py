import sqlite3

import pytest

from server.account_store import add_wallet, get_or_create_account, initialize, list_wallets


def test_accounts_are_idempotent_and_wallets_are_normalized():
    db = sqlite3.connect(":memory:")
    initialize(db)
    first = get_or_create_account(db, "did:privy:abc")
    second = get_or_create_account(db, "did:privy:abc")
    assert first == second
    add_wallet(db, first.id, 4663, "0xABC0000000000000000000000000000000000000")
    assert list_wallets(db, first.id)[0].address == "0xabc0000000000000000000000000000000000000"


def test_same_wallet_cannot_be_bound_to_two_accounts():
    db = sqlite3.connect(":memory:")
    initialize(db)
    a = get_or_create_account(db, "did:privy:a")
    b = get_or_create_account(db, "did:privy:b")
    add_wallet(db, a.id, 4663, "0xabc0000000000000000000000000000000000000")
    with pytest.raises(sqlite3.IntegrityError):
        add_wallet(db, b.id, 4663, "0xABC0000000000000000000000000000000000000")


def test_empty_subject_is_rejected():
    db = sqlite3.connect(":memory:")
    initialize(db)
    with pytest.raises(ValueError):
        get_or_create_account(db, " ")
