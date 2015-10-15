torrent-web
===========

A headless rsync downloader to work with transmission's API

## Setup

```
bower install
npm install
```

Run `node index.js` for testing.

## NGINX vhost example that handles websockets
/usr/local/etc/nginx/sites-enabled/files-sync
```
server {
    listen 80;
    server_name files.example.com;
    access_log /var/log/nginx/access_files.org.log;
    error_log  /var/log/nginx/error_files.org.log warn;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header HOST $http_host;
        proxy_set_header X-NginX-Proxy true;
    }
}
```

## OS X LaunchDaemon example
/Library/LaunchDaemon/file-sync.plist
```
<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
        <dict>
            <key>Label</key>
            <string>file-sync.launcher</string>
            <key>KeepAlive</key>
            <true/>
            <key>ProgramArguments</key>
            <array>
                <string>/usr/local/bin/node</string>
                <string>/usr/local/opt/file-sync/index.js</string>
            </array>
            <key>RunAtLoad</key>
            <true/>
            <key>StandardOutPath</key>
            <string>/var/log/file-sync/output.log</string>
            <key>StandardErrorPath</key>
            <string>/var/log/file-sync/error.log</string>
            <key>WorkingDirectory</key>
            <string>/usr/local/opt/file-sync/</string>
        </dict>
    </plist>
```
