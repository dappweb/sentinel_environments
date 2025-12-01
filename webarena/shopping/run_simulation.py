import time
import requests
import math

DOCKER_SENTINEL_URL = "http://localhost:8000"

response = requests.get(f"{DOCKER_SENTINEL_URL}/status")
response.raise_for_status()
response_data = response.json()

simulation_time = response_data["simulation_time"]
next_event_time = response_data["next_event_time"]

print("Playback at 4x speed")
while True:
    sleep_for = next_event_time - simulation_time
    if sleep_for < 0:
        break

    if simulation_time > 0 and sleep_for > 0:
        print(f"Sleeping for {sleep_for} seconds")
        time.sleep(sleep_for * 0.25)

    next_event_time = math.ceil(next_event_time)
    response = requests.get(
        f"{DOCKER_SENTINEL_URL}/advance", params={"t": next_event_time}
    )
    response.raise_for_status()
    response_data = response.json()

    simulation_time = response_data["simulation_time"]
    next_event_time = response_data["next_event_time"]

    for e in response_data["processed_events"]:
        print("    " + e["type"])
    print()

    if next_event_time is None:
        print("No more scheduled events. Exiting.")
        break
