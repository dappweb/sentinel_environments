import json
import sys
import math
import random

from datetime import datetime, timedelta

def next_vote_time(start_time, current_time, current_votes, N,
                   horizon_days=1.0,
                   decay_fraction=0.3,
                   rng=random):
    """
    Sample the time of the NEXT upvote for a post whose votes are distributed
    like a decaying Poisson process, conditioned on having exactly N upvotes
    within `horizon_days` of start_time.

    This function was LLM-generated, and should be audited.

    Parameters
    ----------
    start_time : datetime
        Time the post was created.
    current_time : datetime
        Time of the last processed vote (or start_time if current_votes == 0).
        You should pass in the time returned by the previous call.
    current_votes : int
        Number of votes that have already occurred (0..N).
    N : int
        Total number of votes to simulate.
    horizon_days : float, optional
        All N votes will occur within this many days from start_time.
        Default: 3 days.
    decay_fraction : float, optional
        Controls how front-loaded the votes are.
        It's the ratio tau / horizon, where tau is the exponential time-scale.
        Smaller -> more front-loaded. Default: 0.5.
    rng : module or Random, optional
        Source of randomness. Must have a .random() method.

    Returns
    -------
    datetime or None
        The time of the next vote, or None if current_votes >= N.
    """

    if current_votes >= N:
        return None  # no more votes

    if N <= 0:
        return None

    # Horizon and decay time (in seconds)
    T = horizon_days * 86400.0
    tau = T * decay_fraction  # exponential time constant

    # Helper: base CDF F(t) on [0, T] for a truncated exponential
    # F(t) = (1 - e^{-t/tau}) / (1 - e^{-T/tau})
    exp_neg_T_tau = math.exp(-T / tau)

    def F(t):
        if t <= 0:
            return 0.0
        if t >= T:
            return 1.0
        return (1.0 - math.exp(-t / tau)) / (1.0 - exp_neg_T_tau)

    # Inverse CDF F^{-1}(p)
    def F_inv(p):
        if p <= 0.0:
            return 0.0
        if p >= 1.0:
            return T
        return -tau * math.log(1.0 - p * (1.0 - exp_neg_T_tau))

    # Time since start in seconds
    elapsed = (current_time - start_time).total_seconds()
    if elapsed < 0:
        raise ValueError("current_time cannot be before start_time")

    # Clamp inside [0, T]
    t_prev = min(max(elapsed, 0.0), T)

    k = current_votes
    R = N - k  # remaining votes

    F_prev = F(t_prev)

    # We’re simulating order statistics:
    # Given N total votes in [0, T] with CDF F,
    # and given the k-th vote at t_prev (with CDF value F_prev),
    # the (k+1)-th vote CDF value is:
    #
    #   F_next = 1 - (1 - F_prev) * (1 - U)^(1/R),
    #
    # where U ~ Uniform(0,1).
    u = rng.random()
    F_next = 1.0 - (1.0 - F_prev) * (1.0 - u) ** (1.0 / R)

    t_next = F_inv(F_next)

    # Convert back to an absolute datetime. We assume current_time corresponds
    # to t_prev on this same [0, T] axis, so we just move forward by the delta.
    delta_seconds = max(0.0, t_next - elapsed)
    return current_time + timedelta(seconds=delta_seconds)

def main():
    n = 0
    for l in sys.stdin:
        record = json.loads(l)['payload']
        timestamp = datetime.fromisoformat(record['timestamp'])
        total_votes = abs(record['net_score'])

        # Posts have one vote by default. What's the delta
        total_votes -= 1

        upvote = record['net_score'] >= 0
        if total_votes > 0:
            votes = 0
            current_time = timestamp
            while True:
                t = next_vote_time(timestamp, current_time, votes, total_votes)
                if t is None:
                    break
                else:
                    votes += 1
                    current_time = t

                    # Dealing with a submission or a comment?
                    if "title" in record:
                        # Submission
                        event = {
                            "time": t.isoformat(),
                            "type": "submission_vote",
                            "payload": { "upvote": upvote, "submission_id": record["id"] },
                        }
                    else:
                        # Comment
                        event = {
                            "time": t.isoformat(),
                            "type": "comment_vote",
                            "payload": { "upvote": upvote, "comment_id": record["id"] },
                        }
                    print(json.dumps(event))
        n = n + 1
        if n > 1000:
            break

if __name__ == "__main__":
    main()
