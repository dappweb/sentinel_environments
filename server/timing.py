"""Scenario timing constants.

The time dimension of the benchmark is designed so a single agent strategy
("sleep until t=X, then check") cannot win the suite. Two properties:

1. `condition_at` is randomized per scenario in `[MIN_CONDITION_AT, MAX_CONDITION_AT]`
   so there is no single shortcut moment to wake up at.
2. A post-condition buffer of events extends past `MAX_CONDITION_AT`, so when the
   harness runs at `MIN_SPEED_FACTOR` (fastest sim-clock) the wall-clock reaction
   window (`REACTION_WINDOW`) is still populated with events. Total event-timeline
   length is `EVENT_TIMELINE_END = MAX_CONDITION_AT + REACTION_WINDOW / MIN_SPEED_FACTOR`.

Kill-at formula (Adam's PR #70 thread):
    kill_at_wall = MAX_CONDITION_AT * speed_factor + REACTION_WINDOW

The `+ REACTION_WINDOW` is 30 *wall-clock* seconds, NOT scaled — so the agent's
think-budget past target is constant across every speed_factor. Examples:
- speed_factor=1.0  → kill_at_wall =  630s (10.5 min)
- speed_factor=2.0  → kill_at_wall = 1230s (20.5 min)
- speed_factor=0.25 → kill_at_wall =  180s (3 min)

The buffer and reaction window are OVERLAPPING, not additive. The buffer is
authored *content* (sim-time events past MAX_CONDITION_AT), not extra *time*
on the wall-clock. At speed_factor=0.25 the 120 sim-sec buffer compresses into
exactly the 30 wall-sec reaction window — same 30 wall-sec, two views. At
speed_factor=1.0 most of the buffer (sim=[630, 720]) fires past kill_at and
is dormant. Buffer existence never shifts kill_at.

Speed-factor convention (matches Adam's PR #70 thread):
- `speed_factor > 1.0` → slower: event at sim=300 fires at wall=300*speed_factor.
- `speed_factor < 1.0` → faster: 1 wall-second covers 1/speed_factor sim-seconds.
- `MIN_SPEED_FACTOR = 0.25` → fastest allowed; 1 wall-second = 4 sim-seconds.

Rationales:
- `MIN_CONDITION_AT = 10` gives the agent a few seconds of boot/poll-setup
  time before anything interesting can happen.
- `MIN_SPEED_FACTOR = 0.25` is the design floor. Any faster and the 120s
  buffer would drain before the reaction window ends, leaving it eventless.
"""

MIN_CONDITION_AT: float = 10.0
MAX_CONDITION_AT: float = 600.0
REACTION_WINDOW: float = 30.0
MIN_SPEED_FACTOR: float = 0.25

EVENT_BUFFER: float = REACTION_WINDOW / MIN_SPEED_FACTOR
EVENT_TIMELINE_END: float = MAX_CONDITION_AT + EVENT_BUFFER
KILL_AT: float = MAX_CONDITION_AT + REACTION_WINDOW

SCENARIO_SEED: int = 42


def validate_speed_factor(x: float) -> float:
    """Raise if non-positive or below MIN_SPEED_FACTOR. Return x unchanged."""
    if not (x > 0):
        raise ValueError(f"speed_factor must be positive, got {x!r}")
    if x < MIN_SPEED_FACTOR:
        raise ValueError(
            f"speed_factor {x} below MIN_SPEED_FACTOR {MIN_SPEED_FACTOR}"
        )
    return x


def kill_at_wall(speed_factor: float) -> float:
    """Wall-clock kill time for a run at the given speed_factor.

    Formula: MAX_CONDITION_AT * speed_factor + REACTION_WINDOW.
    The reaction window stays constant in wall-clock across all speeds.
    """
    return MAX_CONDITION_AT * speed_factor + REACTION_WINDOW
