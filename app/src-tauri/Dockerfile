FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal desktop environment and VNC server
RUN apt-get update && apt-get install -y \
    xfce4 \
    xfce4-terminal \
    tigervnc-standalone-server \
    tigervnc-common \
    python3-websockify \
    python3-numpy \
    supervisor \
    net-tools \
    git \
    python3-pip \
    python3-tk \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -s /bin/bash vncuser
RUN echo "vncuser:vncpassword" | chpasswd

# Set up VNC password
USER vncuser
RUN mkdir -p /home/vncuser/.vnc
RUN echo "vncpassword" | vncpasswd -f > /home/vncuser/.vnc/passwd
RUN chmod 600 /home/vncuser/.vnc/passwd

# Install noVNC
USER root
RUN git clone --branch v1.5.0 https://github.com/novnc/noVNC.git /opt/noVNC && \
    git clone --branch v0.12.0 https://github.com/novnc/websockify /opt/noVNC/utils/websockify && \
    ln -s /opt/noVNC/vnc.html /opt/noVNC/index.html && \
    chown -R vncuser:vncuser /opt/noVNC

# Copy all files from image directory and startup scripts
COPY image/ /
COPY startup.sh /startup.sh
COPY novnc_startup.sh /novnc_startup.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create empty init.py
RUN touch /init.py

# Set execute permissions
RUN chmod +x /startup.sh /novnc_startup.sh /init.py

# Create directory for logs and set permissions
RUN mkdir -p /var/log/supervisor && \
    touch /var/log/supervisor/vnc.log \
        /var/log/supervisor/vnc.err \
        /var/log/supervisor/novnc.log \
        /var/log/supervisor/novnc.err && \
    chown -R vncuser:vncuser /var/log/supervisor && \
    chmod 755 /var/log/supervisor && \
    chmod 644 /var/log/supervisor/*.log /var/log/supervisor/*.err

# Install Python packages from requirements.txt
COPY image/requirements.txt /requirements.txt
RUN pip3 install -r /requirements.txt

# Run the python script
RUN python3 init.py

# Expose ports
EXPOSE 5900
EXPOSE 6080

# Add environment variable for container ID
ENV CONTAINER_ID=""

# Add environment variable for host IP
ENV HOST_IP="host.docker.internal"

# Modify the CMD to accept container ID and host IP
ENTRYPOINT ["/bin/bash", "-c", "export CONTAINER_ID=${CONTAINER_ID} && export HOST_IP=${HOST_IP} && /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf"]

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]