# CinemataCMS Installation Instructions

The instructions have been tested on Ubuntu 22.04. Ensure no other services are running in the system, specifically no nginx/Postgresql, as the installation script will install them and replace any configs.

As root, clone the repository on /home/cinemata and run install.sh:

```
# cd /home
# mkdir cinemata && cd cinemata
# git clone https://github.com/EngageMedia-video/cinematacms cinematacms && cd cinematacms
# chmod +x install.sh
# ./install.sh
```
