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
                    "entity_pk_value": 39276,
                    "title": "Durable, Comfortable, and Safe for Little Listeners - TESTED and APPROVED!",
                    "detail": "Great kid-friendly headphones with smart safety touches. I bought this 2-pack for my kindergarten classroom, and they’ve been a hit. The adjustable headband actually fits small heads properly without slipping, and the lightweight build keeps kids comfortable through story time and short computer sessions. The ABS plastic earcups feel rugged enough for daily classroom use, and the protective slotted baffles are a thoughtful detail—no more curious fingers poking the drivers. Sound quality is clear and balanced for voices, audiobooks, and learning apps. They’re not bass-heavy, but that’s not the goal here; intelligible speech is excellent. The ambient noise-reducing cups help keep volume lower (a big plus for hearing safety), and the child-accessible volume control lets us fine-tune without cranking it. The permanently attached 5.5' cord with reinforced strain relief has survived plenty of tugs, and the right-angle 3.5mm plug sits neatly in tablets and laptops, reducing accidental pull-outs. For classroom or home learning, these check all the boxes: safe, durable, and age-appropriate sizing. Minor nitpicks: the styling is more playful than sleek, which is perfect for young kids but not older ones; and there’s no mic, so not ideal for two-way calls. Overall, excellent value in a 2-pack for schools and parents focused on safe listening and durability.",
                    "nickname": "Ms. K—Kinder Tech",
                    "ratings": [
                        {
                            "rating_id": 4,
                            "rating_name": "Rating",
                            "value": 4,
                            "percent": 80,
                        }
                    ],
                    "review_entity": "product",
                    "review_type": 2,
                    "review_status": 1,
                    "store_id": 1,
                    "stores": [1],
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
