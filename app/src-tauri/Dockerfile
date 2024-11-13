FROM docker.io/library/ubuntu:22.04

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

USER vncuser
RUN mkdir -p /home/vncuser/.vnc

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
RUN chmod +x /startup.sh /novnc_startup.sh /app.py

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

# Expose ports
EXPOSE 5900
EXPOSE 6080

# Add environment variables
ENV CONTAINER_ID=""
ENV HOST_IP="127.0.0.1"
ENV ANTHROPIC_API_KEY=""

# Modify the CMD to accept container ID, host IP, and API key
ENTRYPOINT ["/bin/bash", "-c", "export CONTAINER_ID=${CONTAINER_ID} && export HOST_IP=${HOST_IP} && export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} && /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf"]

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

# Add these lines to disable screen locking and screensaver
RUN mkdir -p /home/vncuser/.config/xfce4/xfconf/xfce-perchannel-xml && \
    echo '<?xml version="1.0" encoding="UTF-8"?>\n\
<channel name="xfce4-screensaver" version="1.0">\n\
  <property name="enabled" type="bool" value="false"/>\n\
  <property name="lock-enabled" type="bool" value="false"/>\n\
</channel>' > /home/vncuser/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-screensaver.xml && \
    echo '<?xml version="1.0" encoding="UTF-8"?>\n\
<channel name="xfce4-power-manager" version="1.0">\n\
  <property name="xfce4-power-manager" type="empty">\n\
    <property name="dpms-enabled" type="bool" value="false"/>\n\
    <property name="blank-on-ac" type="int" value="0"/>\n\
    <property name="lock-screen-suspend-hibernate" type="bool" value="false"/>\n\
  </property>\n\
</channel>' > /home/vncuser/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-power-manager.xml && \
    chown -R vncuser:vncuser /home/vncuser/.config