import websockets
import json
import asyncio
import os
from collections import deque
from pam import run_pam

RUNNING_LOCALLY = True
HEARTBEAT = True

# Global message queue
message_queue = deque()

# Get host IP from environment variable, fallback to localhost
HOST_IP = os.getenv("HOST_IP", "localhost")

async def main(agent_id):
    # Run both coroutines concurrently using asyncio.gather()
    await asyncio.gather(
        run_websocket_client(message_queue, agent_id),
        # run_pam(message_queue)
    )

async def run_websocket_client(message_queue, agent_id):
    # Global websocket connection
    ws_connection = None
    
    async def connect():
        nonlocal ws_connection
        retry_delay = 1  # Initial delay in seconds
        max_delay = 60   # Maximum delay in seconds
        
        while True:
            try:
                ws_connection = await websockets.connect(f'ws://{HOST_IP}:3030/ws')
                print(f"Successfully connected to WebSocket server at {HOST_IP}")
                # Send initial dummy message
                message_queue.appendleft({"type": "agent", "container_id": agent_id, "message-type": "init"})
                return ws_connection
            except Exception as e:
                print(f"Failed to connect to WebSocket server: {e}")
                print(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                # Exponential backoff with max delay
                retry_delay = min(retry_delay * 2, max_delay)

    async def message_handler():
        nonlocal ws_connection
        while True:  # Keep trying to handle messages
            if ws_connection:
                try:
                    while True:
                        message = await ws_connection.recv()
                        print(f"Received message: {message}")
                except websockets.exceptions.ConnectionClosed:
                    print("WebSocket connection closed, attempting to reconnect...")
                except Exception as e:
                    print(f"Error in message handler: {e}")
                
                # Connection lost, try to reconnect
                ws_connection = await connect()
            else:
                # No connection, try to establish one
                ws_connection = await connect()

    async def process_queue():
        nonlocal ws_connection
        while True:
            if ws_connection and message_queue:
                try:
                    message = message_queue[0]  # Peek at first message
                    json_message = json.dumps(message)
                    await ws_connection.send(json_message)
                    message_queue.popleft()  # Only remove after successful send
                except Exception as e:
                    print(f"Failed to send message: {e}")
                    ws_connection = None
                    await connect()
            await asyncio.sleep(0.1)  # Small delay to prevent busy waiting

    async def heartbeat():
        if HEARTBEAT:
            while True:
                print("Sending heartbeat")
                message_queue.append({"message": "Heartbeat ping", "message-type": "message"})
                await asyncio.sleep(10)  # Wait 10 seconds before next heartbeat

    # Connect and start message handler, queue processor and heartbeat
    ws_connection = await connect()
    await asyncio.gather(
        message_handler(),
        process_queue(),
        heartbeat()
    )

# if name is main
if __name__ == "__main__":
    agent_id = os.getenv("CONTAINER_ID")
    if RUNNING_LOCALLY:
        agent_id = "pam-1"
    asyncio.run(main(agent_id))
    print("App finished")