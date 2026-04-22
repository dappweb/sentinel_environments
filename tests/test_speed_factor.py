"""Tests for speed_factor plumbing.

speed_factor is the exchange rate between sim-time and wall-time:
    sim_time = wall_elapsed / speed_factor
So speed_factor > 1 is slower (more wall-seconds per sim-second),
speed_factor < 1 is faster, MIN_SPEED_FACTOR = 0.25 is the fastest allowed.
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.schemas import InitPayload
from server.session import Session
from server.timing import (
    KILL_AT,
    MAX_CONDITION_AT,
    MIN_SPEED_FACTOR,
    REACTION_WINDOW,
    kill_at_wall,
    validate_speed_factor,
)


# ---------------------------------------------------------------------------
# validate_speed_factor
# ---------------------------------------------------------------------------

def test_validate_speed_factor_default_one():
    assert validate_speed_factor(1.0) == 1.0


def test_validate_speed_factor_min_allowed():
    assert validate_speed_factor(MIN_SPEED_FACTOR) == MIN_SPEED_FACTOR


def test_validate_speed_factor_large_allowed():
    # No ceiling — 10x slower is fine.
    assert validate_speed_factor(10.0) == 10.0


def test_validate_speed_factor_below_min_raises():
    with pytest.raises(ValueError, match="below MIN_SPEED_FACTOR"):
        validate_speed_factor(MIN_SPEED_FACTOR / 2)


def test_validate_speed_factor_zero_raises():
    with pytest.raises(ValueError, match="must be positive"):
        validate_speed_factor(0.0)


def test_validate_speed_factor_negative_raises():
    with pytest.raises(ValueError, match="must be positive"):
        validate_speed_factor(-1.0)


# ---------------------------------------------------------------------------
# kill_at_wall
# ---------------------------------------------------------------------------

def test_kill_at_wall_default_matches_constant():
    # speed_factor=1 → kill_at_wall equals the sim-clock KILL_AT constant.
    assert kill_at_wall(1.0) == KILL_AT


def test_kill_at_wall_reaction_window_stays_constant():
    # Reaction window is 30 wall-sec independent of speed_factor.
    # kill_at_wall(sf) - MAX_CONDITION_AT * sf == REACTION_WINDOW for all sf.
    for sf in (0.25, 0.5, 1.0, 2.0, 5.0):
        assert kill_at_wall(sf) - MAX_CONDITION_AT * sf == pytest.approx(REACTION_WINDOW)


def test_kill_at_wall_scales_with_speed():
    # Doubling speed_factor roughly doubles the wall-clock kill time (minus constant reaction).
    assert kill_at_wall(2.0) == pytest.approx(MAX_CONDITION_AT * 2.0 + REACTION_WINDOW)
    assert kill_at_wall(0.25) == pytest.approx(MAX_CONDITION_AT * 0.25 + REACTION_WINDOW)


# ---------------------------------------------------------------------------
# InitPayload schema
# ---------------------------------------------------------------------------

def _base_payload(**overrides):
    body = {
        "environment": "micromail",
        "event_timeline_end": 720.0,
        "eval_sql": "",
        "events": [],
    }
    body.update(overrides)
    return body


def test_init_payload_default_speed_factor():
    p = InitPayload(**_base_payload())
    assert p.speed_factor == 1.0


def test_init_payload_accepts_valid_speed_factor():
    p = InitPayload(**_base_payload(speed_factor=2.5))
    assert p.speed_factor == 2.5


def test_init_payload_rejects_below_min():
    with pytest.raises(ValidationError):
        InitPayload(**_base_payload(speed_factor=0.1))


def test_init_payload_rejects_zero():
    with pytest.raises(ValidationError):
        InitPayload(**_base_payload(speed_factor=0.0))


# ---------------------------------------------------------------------------
# _run_auto timing
# ---------------------------------------------------------------------------

def _make_session(speed_factor: float, events: list[dict]) -> Session:
    return Session(
        status="running_auto",
        simulation_time=0.0,
        start_wall_time=time.time(),
        events=events,
        next_event_index=0,
        environment="micromail",
        event_timeline_end=720.0,
        baseline_metrics={},
        speed_factor=speed_factor,
    )


async def _drive_auto(session: Session, wall_budget: float) -> None:
    """Run _run_auto for up to wall_budget wall-seconds, then cancel."""
    from server import server as srv

    task = asyncio.create_task(srv._run_auto(session))
    try:
        await asyncio.wait_for(task, timeout=wall_budget)
    except asyncio.TimeoutError:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def test_run_auto_advances_sim_time_slower_for_sf_greater_than_one():
    # speed_factor=2 means 1 sim-sec per 2 wall-sec.
    # After ~2 wall-sec, sim_time should be ~1.
    async def run():
        session = _make_session(speed_factor=2.0, events=[{"time": 5.0, "type": "noop"}])
        await _drive_auto(session, wall_budget=2.2)
        return session.simulation_time

    sim_time = asyncio.run(run())
    # Expect ~1.0; give a wide band because asyncio.sleep is not exact.
    assert 0.5 <= sim_time <= 1.8, f"sim_time={sim_time}"


def test_run_auto_advances_sim_time_faster_for_sf_less_than_one():
    # speed_factor=0.25 means 4 sim-sec per 1 wall-sec.
    # After ~1 wall-sec, sim_time should be ~4.
    async def run():
        # Add a sentinel event past the expected drain so the loop keeps running.
        session = _make_session(
            speed_factor=0.25,
            events=[{"time": 100.0, "type": "noop"}],
        )
        await _drive_auto(session, wall_budget=1.1)
        return session.simulation_time

    sim_time = asyncio.run(run())
    assert 2.5 <= sim_time <= 5.5, f"sim_time={sim_time}"
