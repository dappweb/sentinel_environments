"""Persistent account primitives for the MicroHood production API.

This module intentionally stores no bearer-token claims.  Callers must pass a
server-verified Privy subject and wallet address after authentication.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  privy_subject TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS account_wallets (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, chain_id, address),
  UNIQUE (chain_id, address)
);
CREATE TABLE IF NOT EXISTS watchlist (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, symbol)
);
CREATE TABLE IF NOT EXISTS positions (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares REAL NOT NULL DEFAULT 0 CHECK (shares >= 0),
  avg_cost REAL NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, symbol)
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_order_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'filled', 'failed', 'cancelled')),
  tx_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (account_id, client_order_id)
);
"""


@dataclass(frozen=True)
class Account:
    id: int
    privy_subject: str


def initialize(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA)
    connection.commit()


def get_or_create_account(connection: sqlite3.Connection, privy_subject: str) -> Account:
    subject = privy_subject.strip()
    if not subject:
        raise ValueError("privy_subject is required")
    connection.execute(
        "INSERT INTO accounts (privy_subject) VALUES (?) ON CONFLICT(privy_subject) DO NOTHING",
        (subject,),
    )
    row = connection.execute(
        "SELECT id, privy_subject FROM accounts WHERE privy_subject = ?", (subject,)
    ).fetchone()
    connection.commit()
    assert row is not None
    return Account(id=row[0], privy_subject=row[1])


def add_wallet(connection: sqlite3.Connection, account_id: int, chain_id: int, address: str) -> None:
    normalized = address.strip().lower()
    if not normalized or not normalized.startswith("0x"):
        raise ValueError("wallet address must be a hexadecimal address")
    connection.execute(
        "INSERT INTO account_wallets (account_id, chain_id, address) VALUES (?, ?, ?)",
        (account_id, chain_id, normalized),
    )
    connection.commit()
