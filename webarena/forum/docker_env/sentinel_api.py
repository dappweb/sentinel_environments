# sentinel_api.py
import asyncio
import json
from fastapi import FastAPI
from datetime import datetime
import uvicorn
import psycopg2
import gzip

app = FastAPI()

events_file_handle = None
event_queue = []
file_lock = asyncio.Lock()

reference_time = datetime.fromisoformat("2023-02-19T00:00:00+00:00")
db_reference_time = "2023-02-19 00:00:00"

async def _read_next_buffer():
    """Read from events_file_handle until (and including) the next submission."""
    
    event_buffer = []
    async with file_lock:
        while True:
            line = events_file_handle.readline().strip()
            if line == "":
                break
            else:
                event = json.loads(line)
                event_buffer.append(event)
                if event["type"] == "submission":
                    break
        return event_buffer
    

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
    if events_file_handle:
        events_file_handle.close()
    print("[shutdown]")

@app.get("/reset")
async def reset():
    global events_file_handle
    global event_queue
    global time_offset

    # Delete new rows in the database
    cur.execute("TRUNCATE comment_votes")
    cur.execute("TRUNCATE submission_votes")
    cur.execute("DELETE FROM comments WHERE timestamp >= '" + db_reference_time + "'")
    cur.execute("DELETE FROM submissions WHERE timestamp >= '" + db_reference_time + "'")
    conn.commit()

    async with file_lock:
        if events_file_handle:
            events_file_handle.close()
            events_file_handle = None
        events_file_handle = gzip.open("/var/www/html/events.jsonl.gz", "rt") 

    event_queue = await _read_next_buffer()
    time_offset = 0

    return {"time_offset": time_offset, "type": "reset" }

@app.get("/next")
async def next():
    global event_queue

    while event_queue:
        for event_data in event_queue:
            if event_data["type"] == "submission":
                insert_submission(conn, cur, event_data["payload"])
            elif event_data["type"] == "comment":
                insert_comment(conn, cur, event_data["payload"])
            elif event_data["type"] == "submission_vote":
                vote_on_submission(conn, cur, event_data["payload"])
            elif event_data["type"] == "comment_vote":
                vote_on_comment(conn, cur, event_data["payload"])
            print(event_data["type"])

            time_offset = datetime.fromisoformat(event_data["time"]).timestamp() - reference_time.timestamp()
            record_type = event_data["type"]

        event_queue = await _read_next_buffer()
        return {"time_offset": time_offset, "type": record_type }


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
            1,
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
    1
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

def vote_on_submission(conn, cur, data):
    op = "+ 1" if data["upvote"] else "- 1"
    sql = "UPDATE submissions SET net_score=net_score " + op + " WHERE id=%(submission_id)s;"
    cur.execute(sql, {"submission_id": data["submission_id"]})
    conn.commit()

def vote_on_comment(conn, cur, data):
    op = "+ 1" if data["upvote"] else "- 1"
    sql = "UPDATE comments SET net_score=net_score " + op + " WHERE id=%(comment_id)s;"
    cur.execute(sql, {"comment_id": data["comment_id"]})
    conn.commit()

if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
