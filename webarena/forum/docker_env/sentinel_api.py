# sentinel_api.py
import asyncio
import json
from fastapi import FastAPI
from datetime import datetime
import uvicorn
import psycopg2

app = FastAPI()

file_handle = None
file_lock = asyncio.Lock()

reference_time = datetime.fromisoformat("2023-02-19T00:00:00+00:00")

@app.on_event("startup")
async def startup_event():
    global conn
    global cur

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
    if file_handle:
        file_handle.close()
    print("[shutdown]")

@app.get("/reset")
async def reset():
    global file_handle
    global time_offset

    if file_handle:
        file_handle.close()
    file_handle = open("submissions.jsonl", "rt")
    time_offset = 0
    return {"time_offset": time_offset, "type": "reset" }

@app.get("/next")

async def next():
    async with file_lock:
        line = file_handle.readline()
        data = json.loads(line)
        insert_submission(conn, cur, data)
        time_offset = datetime.fromisoformat(data["timestamp"]).timestamp() - reference_time.timestamp()
        return {"time_offset": time_offset, "type": "submission", "title": data["title"] }


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

if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
