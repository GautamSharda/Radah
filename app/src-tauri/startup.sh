#!/bin/bash

# Start VNC server
vncserver :0 -geometry 1024x768 -depth 24 -localhost no

# Keep the script running
tail -f /dev/null 