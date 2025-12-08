"""Generate simulated vote events from net score data."""
import json
import random
import sys
from datetime import datetime, timedelta


def main():
    """Generate vote events from net score data read from stdin."""
    random.seed(1000)

    for line in sys.stdin:
        record = json.loads(line)["payload"]
        timestamp = datetime.fromisoformat(record["timestamp"])
        total_votes = abs(record["net_score"])

        # Posts have one vote by default. What's the delta
        total_votes -= 1
        if total_votes == 0:
            continue
        upvote = total_votes > 0

        # Work out the max delay, which ensures all votes are in within 24h
        max_delay = int((3600 * 24) / abs(total_votes))

        current_time = timestamp
        for i in range(abs(total_votes)):
            # Early votes come in fast
            range_high = min(i + 1, max_delay)
            range_low = max(int(range_high / 4), 1)
            delay = random.randint(range_low, range_high)
            current_time = current_time + timedelta(seconds=delay)

            # Dealing with a submission or a comment?
            if "title" in record:
                # Submission
                event = {
                    "time": current_time.isoformat(),
                    "type": "submission_vote",
                    "payload": {"upvote": upvote, "submission_id": record["id"]},
                }
            else:
                # Comment
                event = {
                    "time": current_time.isoformat(),
                    "type": "comment_vote",
                    "payload": {"upvote": upvote, "comment_id": record["id"]},
                }

            print(json.dumps(event))


if __name__ == "__main__":
    main()
