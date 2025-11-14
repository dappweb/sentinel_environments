import psycopg2
import json
import time

from datetime import datetime

def insert_submission(conn, cur, data):
    sql = """
        INSERT INTO submissions (
            id,
            forum_id,
            user_id,
            title,
            "timestamp",
            url,
            body,
            image_id,
            ip,
            sticky,
            ranking,
            edited_at,
            moderated,
            user_flag,
            locked,
            search_doc,
            last_active,
            comment_count,
            net_score,
            visibility,
            media_type
        ) VALUES (
            %(id)s,
            %(forum_id)s,
            %(user_id)s,
            %(title)s,
            %(timestamp)s,
            %(url)s,
            %(body)s,
            %(image_id)s,
            %(ip)s,
            %(sticky)s,
            %(ranking)s,
            %(edited_at)s,
            %(moderated)s,
            %(user_flag)s,
            %(locked)s,
            %(search_doc)s,
            %(last_active)s,
            0,
            %(net_score)s,
            %(visibility)s,
            %(media_type)s
        );
    """
            #%(comment_count)s,

    cur.execute(sql, data)
    conn.commit()
    print("Submission")

def insert_comment(conn, cur, data):
    sql = """
    INSERT INTO comments (
    id,
    user_id,
    submission_id,
    parent_id,
    body,
    "timestamp",
    visibility,
    ip,
    edited_at,
    moderated,
    user_flag,
    search_doc,
    net_score
) VALUES (
    %(id)s,
    %(user_id)s,
    %(submission_id)s,
    %(parent_id)s,
    %(body)s,
    %(timestamp)s,
    %(visibility)s,
    %(ip)s,
    %(edited_at)s,
    %(moderated)s,
    %(user_flag)s,
    %(search_doc)s,
    %(net_score)s
);
    """

    cur.execute(sql, data)
    conn.commit()

    # Update the comment count
    cur.execute("""
UPDATE submissions AS s
SET comment_count = (
    SELECT COUNT(*)
    FROM comments c
    WHERE c.submission_id = s.id
)
WHERE s.id = %(submission_id)s;
""", {"submission_id": data["submission_id"]})
    conn.commit()

    print("Comment")

def main():
    # Adjust password/host/port as needed
    conn = psycopg2.connect(
        dbname="postmill",
        user="postgres",
        #password="your_password_here",  # or omit if using .pgpass / trust auth
        #host="localhost",
        #port=5432,
    )

    try:
        with conn.cursor() as cur:

            # Clear the database
            cur.execute("TRUNCATE submissions CASCADE")
            conn.commit()

            subs = open("submissions.jsonl", "rt")
            comments = open("comments.jsonl", "rt")

            sub_data = json.loads(subs.readline())
            comment_data = json.loads(comments.readline())

            while True:
                
                # Assume dates are already sorted and in ISO8601
                if sub_data["timestamp"] <= comment_data["timestamp"]:
                    insert_submission(conn, cur, sub_data)
                    sub_data = json.loads(subs.readline())
                else:
                    insert_comment(conn, cur, comment_data)
                    comment_data = json.loads(comments.readline())

                time.sleep(3)

    finally:
        subs.close()
        comments.close()
        conn.close()

if __name__ == "__main__":
    main()
