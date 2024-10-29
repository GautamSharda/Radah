#!/bin/bash

echo "Starting noVNC"

# Debug: List contents of /opt/noVNC/utils
echo "Contents of /opt/noVNC/utils:"
ls -la /opt/noVNC/utils/

# Debug: Check if websockify is installed
echo "Checking websockify installation:"
which websockify

# Start noVNC with novnc_proxy
/opt/noVNC/utils/novnc_proxy \
    --vnc localhost:5900 \
    --listen 6080 \
    --web /opt/noVNC

# If the above fails, try websockify directly
if [ $? -ne 0 ]; then
    echo "novnc_proxy failed, trying websockify directly"
    python3 -m websockify \
        --web=/opt/noVNC \
        6080 \
        localhost:5900
fi