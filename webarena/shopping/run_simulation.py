import time
import requests

DOCKER_SENTINEL_URL = "http://localhost:8000"

response = requests.get(f"{DOCKER_SENTINEL_URL}/status")
response.raise_for_status()
response_data = response.json()

simulation_time = response_data["simulation_time"]
next_event_time = response_data["next_event_time"]

print("Playback at 4x speed")
while True:
    sleep_for = next_event_time - simulation_time
    time.sleep(sleep_for)

    next_event_time = int(
        next_event_time
    )  # TODO: Make event time format consistent with postmill.
    response = requests.get(
        f"{DOCKER_SENTINEL_URL}/advance", params={"t": next_event_time}
    )
    response.raise_for_status()
    response_data = response.json()

    simulation_time = response_data["simulation_time"]
    next_event_time = response_data["next_event_time"]

    print(f"Simulation time: {simulation_time}")
    for e in response_data["processed_events"]:
        print("    " + e["type"])
    print()

    if next_event_time is None:
        print("No more scheduled events. Exiting.")
        break
