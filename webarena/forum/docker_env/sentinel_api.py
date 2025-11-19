# sentinel_api.py
import asyncio
import json
from fastapi import FastAPI
from datetime import datetime
import uvicorn
import psycopg2

app = FastAPI()

submissions_file_handle = None
comments_file_handle = None
file_lock = asyncio.Lock()

reference_time = datetime.fromisoformat("2023-02-19T00:00:00+00:00")
db_reference_time = "2023-02-19 00:00:00"

@app.on_event("startup")
async def startup_event():
    global conn
    global cur

    conn = None
    cur = None

    # Adjust password/host/port as needed
    conn = psycopg2.connect(
        dbname="postmill",
        user="postgres",
    )
    cur = conn.cursor()

    await reset()
    print("[startup] file opened")

@app.on_event("shutdown")
async def shutdown_event():
    if cur:
        cur.close()
    if conn:
        con.close()
    if submissions_file_handle:
        submissions_file_handle.close()
    if comments_file_handle:
        comments_file_handle.close()
    print("[shutdown]")

@app.get("/reset")
async def reset():
    global submissions_file_handle
    global comments_file_handle
    global submission_data 
    global comment_data
    global time_offset

    # Delete new rows in the database
    cur.execute("TRUNCATE comment_votes")
    cur.execute("TRUNCATE submission_votes")
    cur.execute("DELETE FROM comments WHERE timestamp >= '" + db_reference_time + "'")
    cur.execute("DELETE FROM submissions WHERE timestamp >= '" + db_reference_time + "'")
    conn.commit()

    async with file_lock:
        if submissions_file_handle:
            submissions_file_handle.close()
            submissions_file_handle = None
        if comments_file_handle:
            comments_file_handle.close()
            comments_file_handle = None
        submissions_file_handle = open("/var/www/html/submissions.jsonl", "rt")
        comments_file_handle = open("/var/www/html/comments.jsonl", "rt")

        submission_data = json.loads(submissions_file_handle.readline())
        comment_data = json.loads(comments_file_handle.readline())

    time_offset = 0

    return {"time_offset": time_offset, "type": "reset" }

@app.get("/next")

async def next():

    global submission_data 
    global comment_data

    async with file_lock:

        while True:
            if submission_data["timestamp"] <= comment_data["timestamp"]:
                insert_submission(conn, cur, submission_data)
                time_offset = datetime.fromisoformat(submission_data["timestamp"]).timestamp() - reference_time.timestamp()
                title = submission_data["title"]
                record_type = "submission"
                submission_data = json.loads(submissions_file_handle.readline())
                break
            else:
                insert_comment(conn, cur, comment_data)
                time_offset = datetime.fromisoformat(comment_data["timestamp"]).timestamp() - reference_time.timestamp()
                title = comment_data["body"]
                record_type = "comment"
                comment_data = json.loads(comments_file_handle.readline())
        
        return {"time_offset": time_offset, "type": record_type, "title": title }



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
            0,
            %(visibility)s,
            %(media_type)s
        );
    """
    cur.execute(sql, data)
    conn.commit()


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


if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
