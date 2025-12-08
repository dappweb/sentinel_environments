"""Merge-sort 4 jsonl files (submissions, comments, submission_votes, comment_votes)."""
import json
import math
from datetime import datetime


def next_record(fh):
    """Read the next record from a jsonl file handle."""
    line = fh.readline().strip()
    if line == "":
        return None
    else:
        return json.loads(line)


def get_time(record):
    """Get the timestamp of a record, or infinity if None."""
    if record is None:
        return float("inf")
    else:
        return datetime.fromisoformat(record["time"]).timestamp()


def main():
    """Merge-sort the 4 jsonl files."""
    submissions_fh = open("/var/www/html/submissions.jsonl")
    comments_fh = open("/var/www/html/comments.jsonl")
    submission_votes_fh = open("/var/www/html/submission_votes.jsonl")
    comment_votes_fh = open("/var/www/html/comment_votes.jsonl")

    next_submission = next_record(submissions_fh)
    next_comment = next_record(comments_fh)
    next_submission_vote = next_record(submission_votes_fh)
    next_comment_vote = next_record(comment_votes_fh)

    while True:
        arr = [
            get_time(next_submission),
            get_time(next_comment),
            get_time(next_submission_vote),
            get_time(next_comment_vote),
        ]
        min_time = min(arr)
        if math.isinf(min_time):
            break
        else:
            min_idx = arr.index(min_time)
            if min_idx == 0:
                print(json.dumps(next_submission))
                next_submission = next_record(submissions_fh)
            elif min_idx == 1:
                print(json.dumps(next_comment))
                next_comment = next_record(comments_fh)
            elif min_idx == 2:
                print(json.dumps(next_submission_vote))
                next_submission_vote = next_record(submission_votes_fh)
            elif min_idx == 3:
                print(json.dumps(next_comment_vote))
                next_comment_vote = next_record(comment_votes_fh)

    submissions_fh.close()
    comments_fh.close()
    submission_votes_fh.close()
    comment_votes_fh.close()


if __name__ == "__main__":
    main()
