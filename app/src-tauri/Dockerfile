FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal desktop environment and VNC server
RUN apt-get update && apt-get install -y \
    xfce4 \
    xfce4-terminal \
    tigervnc-standalone-server \
    tigervnc-common \
    novnc \
    websockify \
    supervisor \
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

# Copy startup scripts
USER root
COPY startup.sh /startup.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /startup.sh

# Expose ports
EXPOSE 5900
EXPOSE 6080

CMD ["/usr/bin/supervisord"] 