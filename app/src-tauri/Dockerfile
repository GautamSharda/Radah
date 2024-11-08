FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Add Mozilla PPA for Firefox
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y ppa:mozillateam/ppa && \
    echo 'Package: *\nPin: release o=LP-PPA-mozillateam\nPin-Priority: 1001' | tee /etc/apt/preferences.d/mozilla-firefox


# Install minimal desktop environment, VNC server, and Firefox
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
    fonts-dejavu \
    mesa-utils \
    firefox \
    gnome-screenshot \
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

#Add the python app to the supervisor conf
# RUN echo "\n\
# [program:python_app]\n\
# command=python3 /app.py\n\
# user=vncuser\n\
# environment=DISPLAY=:1,HOME=/home/vncuser,XAUTHORITY=/home/vncuser/.Xauthority\n\
# autostart=true\n\
# autorestart=true\n\
# priority=200\n\
# depends_on=vnc\n\
# startretries=5\n\
# startsecs=10" >> /etc/supervisor/conf.d/supervisord.conf

# Expose ports
EXPOSE 5900
EXPOSE 6080

# Add environment variables
ENV CONTAINER_ID=""
ENV ANTHROPIC_API_KEY=""
ENV HOST_IP="host.docker.internal"
ENV ANTHROPIC_API_KEY=""

# Modify the CMD to accept container ID, host IP, and API key
ENTRYPOINT ["/bin/bash", "-c", "export CONTAINER_ID=${CONTAINER_ID} && export HOST_IP=${HOST_IP} && export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} && /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf"]

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]