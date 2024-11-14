import websockets
import json
import asyncio
import os
import base64
from collections import deque
from pam import run_pam
import platform

#Config
MOCKDATA = False

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


def get_prompt_running():
    return prompt_running[0]


async def process_incoming_files(agent_id, files):
    for file in files:
        file_name = file.get("name")
        file_data = file.get("data")
        if file_name and file_data:
            try:
                # Extract the base64 data after the comma
                base64_data = file_data.split(',')[1]
                decoded_data = base64.b64decode(base64_data)
                
                base_path = os.path.expanduser("~/Desktop")
                
                # Create agent-specific directory within the base path
                file_path = os.path.join(base_path, "uploaded-files")
                print(f"Creating directory {file_path}")
                os.makedirs(file_path, exist_ok=True)
                full_path = os.path.join(file_path, file_name)

                print(f"Saving file {file_name} to {full_path}")
                
                # Save the file
                with open(full_path, "wb") as f:
                    f.write(decoded_data)
                print(f"Successfully saved file {file_name} to {full_path}")
                
            except IndexError:
                print(f"Error: Invalid base64 data format for file {file_name}")
            except base64.binascii.Error:
                print(f"Error: Invalid base64 encoding for file {file_name}")
            except Exception as e:
                print(f"Error processing file {file_name}: {str(e)}")

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
        message_buffers = {}  # Use a dictionary to store message buffers by message_id
        
        async def promptMessageHandler(json_message):
            print(f"Prompt message handler: {json_message}")
            if json_message["message-type"] != "prompt" or prompt_running[0] != "stopped" or "text" not in json_message:
                return
            prompt_running[0] = "running"
            files = json_message.get("files", [])
            print(len(files))
            if files and len(files) > 0:
                print('we got files')
                await process_incoming_files(agent_id, files)

            recent_messages = [message["agent-message"] for message in json_message.get("recent-messages", []) if "agent-message" in message]

            additional_system_prompt = json_message.get("additional_system_prompt", "")
            print(f"Additional system prompt: {additional_system_prompt}")
            try:
                await run_pam(message_queue, json_message["text"], recent_messages, get_prompt_running, MOCKDATA, additional_system_prompt)
            except Exception as e:
                message_queue.append({"message-type": "message", "text": f"Error running Pam: {str(e)}", "error": True, "show_ui": True })
                print(f"Error running Pam: {e}")
            finally:
                prompt_running[0] = "stopped"
                message_queue.append({"message-type": "message", "text": "The agent has finished running", "end_message": True, "show_ui": True, "prompt_running": prompt_running[0] })
                print("Pam finished")

        while True:
            if ws_connection:
                try:
                    while True:
                        message = await ws_connection.recv()
                        json_message = json.loads(message)
                        print(f"Received message: {json_message}\n\n")
                        if "message_id" in json_message and "chunk" in json_message and "total_chunks" in json_message:
                            message_id = json_message["message_id"]
                            chunk = json_message["chunk"]
                            total_chunks = json_message["total_chunks"]
                            data = json_message["data"]

                            if message_id not in message_buffers:
                                message_buffers[message_id] = {}

                            message_buffers[message_id][chunk] = data
                            
                            if len(message_buffers[message_id]) == total_chunks:
                                full_message = ''.join(message_buffers[message_id][i] for i in range(total_chunks))
                                json_message = json.loads(full_message)
                                del message_buffers[message_id]  # Clear buffer after processing

                                if json_message["message-type"] == "prompt":
                                    asyncio.create_task(promptMessageHandler(json_message))
                                elif json_message["message-type"] == "stop":
                                    print("Updating prompt running to stopped")
                                    prompt_running[0] = "stopped"

                except websockets.exceptions.ConnectionClosed:
                    print("WebSocket connection closed, attempting to reconnect...")
                except Exception as e:
                    print(f"Error in message handler: {e}")
                ws_connection = await connect()
            else:
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

    # Connect and start message handler, queue processor and heartbeat
    ws_connection = await connect()
    await asyncio.gather(
        message_handler(),
        process_queue(),
    )

def ensure_upload_directory():
    upload_dir = "agent_files"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    print(f"Upload directory set to: {upload_dir}")

# if name is main
if __name__ == "__main__":
    #ensure_upload_directory()
    agent_id = os.getenv("CONTAINER_ID")
    if RUNNING_LOCALLY:
        agent_id = "pam-1"
    asyncio.run(main(agent_id))