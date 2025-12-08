# sentinel_api.py
import os
import asyncio
import json
import sys
import fastapi
from fastapi.responses import JSONResponse
from datetime import datetime
import uvicorn
import gzip
import signal
import socket
import subprocess
import mysql.connector

from products import add_product, update_stock_for_product
from reviews import add_product_review
from auth import get_admin_token, create_customer_account
from product_sales import add_product_sales_rule
from generate_events import event_types

SERVER_URL = f"{socket.gethostname()}.redmond.corp.microsoft.com"

app = fastapi.FastAPI()
state = "starting"

# Events passed via init()
custom_events = []

file_lock = asyncio.Lock()
events_file_handle = None
next_event = None

simulation_time = 0


# Time of simulation start (at when shopping events were generated.)
webarena_reference_time = datetime.fromisoformat("2025-12-03T16:44:25+00:00")

# This is how time is expressed to through all public APIs
simulation_time = 0


def _connect_to_mariadb():
    try:
        # Establish connection
        conn = mysql.connector.connect(
            user="magentouser",  # DB username
            password="MyPassword",  # DB password
            host="127.0.0.1",  # Host (use IP or domain)
            port=3306,  # Default MariaDB/MySQL port
            database="magentodb",  # Database name
        )

        if conn.is_connected():
            print(
                f"[_connect_to_mariadb] connection successful. DB info: {conn.get_server_info()}"
            )
        return conn

    except mysql.connector.Error as e:
        raise Exception(f"Error connecting to MariaDB: {e.msg}")


def _setup_magento():
    """Set up Magento to use the correct base URL."""
    conn = _connect_to_mariadb()
    curr = conn.cursor()
    curr.execute(
        f'UPDATE core_config_data SET value="http://{SERVER_URL}:7770/" WHERE path = "web/secure/base_url";'
    )
    print(f"[_setup_magento] {curr.rowcount} rows updated")
    conn.commit()
    conn.close()

    # Setup store_config and flush the cache, using subprocess
    try:
        output = subprocess.check_output(
            [
                "/var/www/magento2/bin/magento",
                "setup:store-config:set",
                "--base-url",
                f"http://{SERVER_URL}:7770/",
            ]
        )
        print(f"[_setup_magento] store config set: {output.decode()}")
    except subprocess.CalledProcessError as e:
        raise Exception(f"Error setting up Magento store config: {e.output.decode()}")

    # Flush the cache
    try:
        output = subprocess.check_output(
            ["/var/www/magento2/bin/magento", "cache:flush"]
        )
        print(f"[_setup_magento] cache flushed: {output.decode()}")
    except subprocess.CalledProcessError as e:
        raise Exception(f"Error flushing Magento cache: {e.output.decode()}")


async def _next_file_event():
    """Return the next event from the events file."""
    async with file_lock:
        line = events_file_handle.readline().strip()
        if line == "":
            return None
        else:
            event_data = json.loads(line)

            # Make the timestamps relative, and in seconds
            event_data["time"] = int(
                datetime.fromisoformat(event_data["time"]).timestamp()
                - webarena_reference_time.timestamp()
            )

            return event_data


async def _next_event():
    global custom_events
    global next_file_event

    if len(custom_events) == 0:
        # No custom events, just read from the file
        result = next_file_event
        next_file_event = await _next_file_event()
    elif next_file_event is None:
        # No file events, just read from the custom events list
        if len(custom_events) > 0:
            print(f"[next_event] custom event used: {custom_events[0]['type']}")
            result = custom_events.pop(0)
    else:
        # Return whichever event is earliest
        if custom_events[0]["time"] <= next_file_event["time"]:
            print(f"[next_event] custom event used: {custom_events[0]['type']}")
            result = custom_events.pop(0)
        else:
            result = next_file_event
            next_file_event = await _next_file_event()
    return result


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
    global next_file_event
    global next_event
    global simulation_time

    events_file_handle = gzip.open("/var/www/html/events.jsonl.gz", "rt")

    next_file_event = await _next_file_event()
    next_event = await _next_event()
    simulation_time = 0

    # Sleep for 60s to allow the magento instance and services to start according to the webarena docs
    # https://github.com/web-arena-x/webarena/blob/main/environment_docker/README.md#shopping-website-onestopshop
    await asyncio.sleep(60)

    # Connect to the db, initialize settings
    _setup_magento()

    state = "preinit"
    print("[startup] events file opened")

    # Initialize the customer account with the REST API
    create_customer_account()


@app.on_event("shutdown")
async def shutdown_event():
    if events_file_handle:
        events_file_handle.close()
    print("[shutdown]")


@app.get("/status")
async def status():
    next_event_time = None
    if next_event is not None:
        next_event_time = next_event["time"]

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        },
    )


@app.post("/init")
async def init(request: fastapi.Request):
    global simulation_time
    global custom_events
    global next_event
    global state

    data = await request.json()
    custom_events = data["events"]

    # Sort custom events by time. Don't assume they are pre-sorted.
    custom_events.sort(key=lambda e: e["time"], reverse=False)

    simulation_time = 0

    state = "running"

    next_event_time = None
    if next_event is not None:
        next_event_time = next_event["time"]

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
        next_event_time = next_event["time"]

        while next_event_time <= t:
            processed_events.append(next_event)

            # Process each type of event.
            admin_token = get_admin_token()
            event_type = next_event["type"]
            event_type = event_types[event_type]
            if event_type == event_types.ADD_PRODUCT:
                add_product(
                    token=admin_token,
                    sku=next_event["payload"]["product"]["sku"],
                    product=next_event["payload"],
                )
            elif event_type == event_types.ADD_SALE:
                product_id = (
                    next_event["payload"].get("rule", {}).get("product_ids", [None])[0]
                )
                if product_id:
                    add_product_sales_rule(
                        admin_token, product_id, next_event["payload"]
                    )
            elif event_type == event_types.ADD_PRODUCT_REVIEW:
                product_id = (
                    next_event["payload"].get("review", {}).get("entity_pk_value")
                )
                add_product_review(admin_token, product_id, next_event["payload"])
            elif event_type == event_types.RESTOCK_PRODUCT:
                sku = next_event["payload"].get("sku")

                # Remove sku from payload as it's not part of stock update API
                payload_copy = next_event["payload"].copy()
                del payload_copy["sku"]
                update_stock_for_product(admin_token, sku, payload_copy)

            next_event = await _next_event()
            print(
                f"[advance] processed event, time={simulation_time}, next_event={next_event['type']}"
            )
            if next_event is None:
                next_event_time = None
                break
            else:
                next_event_time = next_event["time"]

    simulation_time = t
    if next_event is not None:
        next_event_time = next_event["time"]

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


@app.get("/close")
async def status():
    global state

    state = "stopping"
    os.kill(1, signal.SIGTERM)  # Will kill the docker container

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
        },
    )


@app.get("/play")
async def play():
    asyncio.create_task(_run_scenario())

    if next_event is not None:
        next_event_time = next_event["time"]

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        },
    )


async def _run_scenario():
    while True:
        if next_event is None:
            break
        await asyncio.sleep(1)
        await next(t=simulation_time + 1)


if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
