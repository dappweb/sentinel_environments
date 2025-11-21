# sentinel_api.py
import asyncio
import json
import fastapi
from fastapi.responses import JSONResponse
from datetime import datetime
import uvicorn
import gzip
from products import add_product
from auth import get_admin_token
from product_sales import add_product_sales_rule

app = fastapi.FastAPI()
state = "starting"

file_lock = asyncio.Lock()
events_file_handle = None
next_event = None

reference_time = datetime.fromisoformat("2023-02-19T00:00:00+00:00")

simulation_time = 0


async def _read_next_event():
    async with file_lock:
        line = events_file_handle.readline().strip()
        if line == "":
            return None
        else:
            return json.loads(line)


@app.exception_handler(Exception)
async def internal_server_error_handler(request: fastapi.Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc),
        },
    )


@app.on_event("startup")
async def startup_event():
    global state
    global events_file_handle
    global next_event

    events_file_handle = gzip.open("events.jsonl.gz", "rt")
    next_event = await _read_next_event()
    state = "running"
    print("[startup] events file opened")


@app.on_event("shutdown")
async def shutdown_event():
    if events_file_handle:
        events_file_handle.close()
    print("[shutdown]")


@app.get("/status")
async def status():
    next_event_time = None
    if next_event is not None:
        next_event_time = (
            datetime.fromisoformat(next_event["time"]).timestamp()
            - reference_time.timestamp()
        )

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        },
    )


@app.get("/advance")
async def next(t: int):
    global simulation_time
    global next_event

    if t <= simulation_time:
        raise ValueError("Simulation time cannot go backwards.")

    processed_events = []

    if next_event is not None:
        next_event_time = (
            datetime.fromisoformat(next_event["time"]).timestamp()
            - reference_time.timestamp()
        )

        while next_event_time <= t:
            processed_events.append(next_event)

            # Process each type of event.
            admin_token = get_admin_token()
            if next_event["type"] == "add_product":
                add_product(
                    token=admin_token,
                    sku=next_event["payload"]["product"]["sku"],
                    product=next_event["payload"],
                )
            elif next_event["type"] == "add_sale":
                product_id = (
                    next_event["payload"].get("rule", {}).get("product_ids", [None])[0]
                )
                if product_id:
                    add_product_sales_rule(
                        admin_token, product_id, next_event["payload"]
                    )

            next_event = await _read_next_event()
            if next_event is None:
                break
            else:
                next_event_time = (
                    datetime.fromisoformat(next_event["time"]).timestamp()
                    - reference_time.timestamp()
                )

    simulation_time = t
    if next_event is not None:
        next_event_time = (
            datetime.fromisoformat(next_event["time"]).timestamp()
            - reference_time.timestamp()
        )

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
            "processed_events": processed_events,
        },
    )


if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
