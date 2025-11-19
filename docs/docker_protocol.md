# Docker Protocol for Advancing Events

This document outlines the minimal REST api protocol, to be hosted in the Docker sentinal environment
container, for advancing scheduled events.

## Endpoints

### GET /status
Returns the status of the Docker sentinel environment. Results are returned in JSON format. The HTTP
response codes will be 200 for success, 500 for server error, etc.

#### Example Successful Response (200 OK):
```json
{ 
  "success": true,
  "status": "running",
  "simulation_time": "2024-06-01T12:00:00Z",
  "next_event_time": "2024-06-01T12:05:00Z"
}
```

Status codes can include:

- "*starting*": The environment is starting up.
- "*preinit*":  The environment is ready, but init has not yet been called.
- "*running*":  The environment is ready for agent interactions


#### Example Error Response (500 Internal Server Error):
```json
{ 
  "success": false,
  "message": "Internal server error"
}
```


### POST /init
Initializes the Docker sentinel environment with task-specific events (in addition
to the default events). The request body should contain a JSON object with an array of events.

Example Request Body:
```json
{
  "events": [
    {
      "time": "2024-06-01T12:10:00Z",
      "type": "custom_event_type_1",
      "payload":  "... Arbitrary JSON data"
    },
    {
      "time": "2024-06-01T12:15:00Z",
      "type": "custom_event_type_2",
      "payload":  "... Arbitrary JSON data"
    }
  ]
}
```

**NOTE 1**: The `/init` endpoint can only be called when the environment is in state `preinit`.
Calls outside this state will return an error.

**NOTE 2**: Times must be in ISO 8601 format with date and time to the second, with Zulu timezone (e.g., "2024-06-01T12:00:00Z").
Times can then be sorted lexicographically. 

**NOTE 3**: "... Arbitrary JSON data" indicates that any valid JSON data can be placed in the payload. It isn't necessarily a string, and should not be double-encoded.


Example Successful Response (200 OK):
```json
{ 
  "success": true,
  "simulation_time": "2024-06-01T12:00:00Z",
  "next_event_time": "2024-06-01T12:05:00Z"
}
```

### GET /advance?time=\<ISO8601\_TIMESTAMP\_WITH\_ZULU\_TIMEZONE\>

Advances the simulation time to the specified timestamp, processing all events scheduled up to, 
and including, that time. The `time` parameter must be in ISO 8601 format with Zulu timezone.

Example Request:
```
GET /advance?time=2024-06-01T12:10:00Z
```

Example Successful Response (200 OK):
```json
{ 
  "success": true,
  "simulation_time": "2024-06-01T12:10:00Z",
  "processed_events": [
    {
      "time": "2024-06-01T12:05:00Z",
      "type": "default_event_type_1",
      "payload":  "... Arbitrary JSON data"
    },
    {
      "time": "2024-06-01T12:10:00Z",
      "type": "custom_event_type_1",
      "payload":  "... Arbitrary JSON data"
    }
  ],
  "next_event_time": "2024-06-01T12:15:00Z"
}
```

**NOTE 1**: If there are no more scheduled events after processing, the `next_event_time` field will be `null`.
**NOTE 2**: If the specified `time` is earlier than the current simulation time, an error will be returned.

## Other Considerations

- All responses include `success`, `simulation_time`, and `next_event_time` fields.
- Calling `/status` does not modify the state of the environment and can be use to learn the simulaiton time
- All timestamps must be in ISO 8601 format with Zulu timezone (e.g., "2024-06-01T12:00:00Z").
- The generic schema of an event is `{ "time": "<ISO8601_TIMESTAMP_WITH_ZULU_TIMEZONE>", "type": "<EVENT_TYPE>", "payload": <ARBITRARY_JSON_DATA> }`, and, **when serializing, the `time` field should always come first.**
- When events are serialized in JSONL, sorting lexicographically will yield the correct chronological order.


## Pseudo For Advancing Events in Real-time

```python
import requests
import time
from datetime import datetime

DOCKER_SENTINEL_URL = "http://docker-sentinel-environment:8000"

# Poll the status endpoint until the environment is ready
while True:
    response = requests.get(f"{DOCKER_SENTINEL_URL}/status")
    response.raise_for_status()
    status_data = response.json()

    if status_data["status"] == "running":
	raise Exception("Environment already running; cannot initialize.")

    if status_data["status"] == "preinit":
	break

    time.sleep(1)  # Wait before polling again

# Initialize the environment
init_events = {
    "events": []  # No events to add in this example
}
reponse = requests.post(f"{DOCKER_SENTINEL_URL}/init", json=init_events)
response.raise_for_status()
response_data = response.json()

simulation_time = datetime.fromisoformat(response_data["simulation_time"])
next_event_time = datetime.fromisoformat(response_data["next_event_time"])

while True:
   sleep_for = (next_event_time - simulation_time).total_seconds()
   time.sleep(sleep_for)

   # Compute the advance time
   advance_time_str = next_event_time.isoformat() + "Z" # Append Zulu timezone

   response = requests.get(f"{DOCKER_SENTINEL_URL}/advance", params={"time": advance_time_str})
   response.raise_for_status()
   response_data = response.json()

   print(f"Processed {len(response_data["processed_events"]) events up to {response_data['simulation_time']}")

   if response_data["next_event_time"] is None:
       print("No more scheduled events. Exiting.")
       break

   simulation_time = datetime.fromisoformat(response_data["simulation_time"])
   next_event_time = datetime.fromisoformat(response_data["next_event_time"])
```
