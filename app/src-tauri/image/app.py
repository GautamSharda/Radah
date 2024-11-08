import websockets
import json
import asyncio
import os
from collections import deque
from pam import run_pam

#Config
HEARTBEAT = False

# Global variables
prompt_running = ["stopped"] #"running", "stopped", "loading", "na"
# Global message queue
message_queue = deque()

# Get host IP from environment variable, fallback to localhost

HOST_IP = os.getenv("HOST_IP")
RUNNING_LOCALLY = False
if not HOST_IP:
    HOST_IP = "localhost"
    RUNNING_LOCALLY = True
#is running loc


def get_prompt_running():
    print('we have hit global prompt running')
    print(f'prompt running: {prompt_running[0]}')
    return prompt_running[0]

async def main(agent_id):
    # Run both coroutines concurrently using asyncio.gather()
    await asyncio.gather(run_websocket_client(message_queue, agent_id))

async def run_websocket_client(message_queue, agent_id):
    # Global websocket connection
    ws_connection = None
    
    async def connect():
        nonlocal ws_connection
        retry_delay = 1  # Initial delay in seconds
        max_delay = 12   # Maximum delay in seconds
        
        while True:
            try:
                ws_connection = await websockets.connect(f'ws://{HOST_IP}:3030/ws')
                print(f"Successfully connected to WebSocket server at {HOST_IP}")
                # Send initial dummy message
                message_queue.appendleft({"connection-type": "agent", "container_id": agent_id, "agent_id": agent_id, "message-type": "init", "prompt_running": prompt_running[0], "show_ui": False})
                return ws_connection
            except Exception as e:
                print(f"Failed to connect to WebSocket server: {e}")
                print(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                # Exponential backoff with max delay
                retry_delay = min(retry_delay * 2, max_delay)

    async def message_handler():
        nonlocal ws_connection

        async def promptMessageHandler(json_message):
            if json_message["message-type"] != "prompt" or prompt_running[0] != "stopped" or "text" not in json_message:
                return
            prompt_running[0] = "running"
            #format all recent messages as an array of messages
            recent_messages = [message["agent-message"] for message in json_message.get("recent-messages", []) if "agent-message" in message]
            try:
                #This is where the magic happens
                await run_pam(message_queue, json_message["text"], recent_messages, get_prompt_running)
            except Exception as e:
                message_queue.append({"message-type": "message", "text": f"Error running Pam: {str(e)}", "error": True, "show_ui": True })
                print(f"Error running Pam: {e}")
            finally:
                prompt_running[0] = "stopped"
                message_queue.append({"message-type": "message", "text": "The agent has finished running", "end_message": True, "show_ui": True, "prompt_running": prompt_running[0] })
                print("Pam finished")


        while True:  # Keep trying to handle messages
            if ws_connection:
                try:
                    while True:
                        message = await ws_connection.recv()
                        json_message = json.loads(message)
                        print(f"Received message: {json_message}\n\n")
                        if json_message["message-type"] == "prompt":
                            asyncio.create_task(promptMessageHandler(json_message))
                        elif json_message["message-type"] == "stop":
                            print("Updating prompt running to stopped")
                            prompt_running[0] = "stopped"

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
                message_queue.append({"message-type": "message", "text": "Heartbeat ping", "show_ui": True })
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