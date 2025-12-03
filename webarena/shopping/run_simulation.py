from enum import Enum
import time
import requests
import json
import argparse


DOCKER_SENTINEL_URL = "http://localhost:8000"
event_types = Enum(
    "EventType",
    [
        "ADD_PRODUCT",
        "UNSTOCK_PRODUCT",
        "RESTOCK_PRODUCT",
        "ADD_SALE",
        "ADD_PRODUCT_REVIEW",
    ],
)


def generate_shopping_init_events():
    events = [
        {
            "type": event_types.ADD_PRODUCT_REVIEW.name,
            "time": 10,
            "payload": {
                "review": {
                    "entity_pk_value": 24,
                    "status_id": 1,
                    "title": "Great product!",
                    "detail": "I really enjoyed using this product. Highly recommend!",
                    "nickname": "HappyCustomer",
                    "customer_id": 123,
                }
            },
        }
    ]

    return events


def _poll_until(target_states, valid_states=None):
    """
    Poll the server until it is in the desired state.

    target_states: the function returns when the server is in one of these states
    valid_states: [Optiona] list of valid states. Raise an error if not in one of these states.
    """

    while True:
        response = requests.get(f"{DOCKER_SENTINEL_URL}/status")
        response.raise_for_status()
        status_data = response.json()

        if status_data["status"] in target_states:
            return status_data

        if valid_states is not None and status_data["status"] not in valid_states:
            raise Exception(f"Invalid state: {status_data['status']}")

        time.sleep(1)  # Wait before polling again


def main():
    parser = argparse.ArgumentParser(
        description="Run shopping simulation against Docker Sentinel server."
    )
    parser.add_argument(
        "--playback-speed", type=float, default=1.0, help="Playback speed"
    )
    parser.add_argument(
        "--close", action="store_true", help="Close the server after simulation"
    )
    args = parser.parse_args()

    if args.close:
        # Send close signal to server
        response = requests.get(f"{DOCKER_SENTINEL_URL}/close")
        response.raise_for_status()
        print("Sent close signal to server.")
        return

    # Wait for things to start up
    response_data = _poll_until(target_states=["preinit"], valid_states=["starting"])

    # Initialize the server
    init_events = generate_shopping_init_events()
    events = {
        "events": init_events,
    }
    response = requests.post(f"{DOCKER_SENTINEL_URL}/init", json=events)
    response.raise_for_status()
    response_data = response.json()

    print("Done init()")

    simulation_time = response_data["simulation_time"]
    next_event_time = response_data["next_event_time"]

    # Run the simulation
    print(f"Playback at {args.playback_speed}x speed")
    while True:
        sleep_for = next_event_time - simulation_time

        print(
            f"Sleeping for {sleep_for} seconds (real time: {sleep_for * (1 / args.playback_speed)} seconds)"
        )
        time.sleep(sleep_for * (1 / args.playback_speed))

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


main()
