const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const { SerialPort, ReadlineParser } = require("serialport");

const PORT = 3000;
const BAUD_RATE = 115200;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve the dashboard
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Broadcast sensor data to all open browser windows
function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

// Track open serial ports so we auto-connect without hardcoding COM numbers
const activePorts = new Map();

async function scanAndConnectESP32() {
  try {
    const ports = await SerialPort.list();
    for (const info of ports) {
      const portPath = info.path;

      // On Mac, skip Bluetooth/debug virtual ports
      if (process.platform === "darwin" && !/usb|slab|wch|modem/i.test(portPath)) {
        continue;
      }

      if (activePorts.has(portPath)) continue;

      const port = new SerialPort({
        path: portPath,
        baudRate: BAUD_RATE,
        autoOpen: false,
      });

      activePorts.set(portPath, port);

      port.open((err) => {
        if (err) {
          activePorts.delete(portPath);
          return;
        }
        console.log(`✅ [USB] Listening for ESP32 data on ${portPath}`);

        const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

        parser.on("data", (line) => {
          const raw = line.trim();
          if (!raw.startsWith("{")) return;
          try {
            const data = JSON.parse(raw);
            if (
              data.toe !== undefined ||
              data.inner !== undefined ||
              data.outer !== undefined ||
              data.heel !== undefined
            ) {
              broadcast({
                type: "pressure",
                port: portPath,
                toe: Math.max(0, Math.min(4095, Number(data.toe) || 0)),
                inner: Math.max(0, Math.min(4095, Number(data.inner) || 0)),
                outer: Math.max(0, Math.min(4095, Number(data.outer) || 0)),
                heel: Math.max(0, Math.min(4095, Number(data.heel) || 0)),
                timestamp: Date.now(),
              });
            }
          } catch (_e) {
            // Ignore partial serial lines on boot
          }
        });

        port.on("close", () => {
          console.log(`⚠️ [USB] Disconnected from ${portPath}`);
          activePorts.delete(portPath);
          broadcast({ type: "status", connected: false });
        });

        port.on("error", () => {
          activePorts.delete(portPath);
        });
      });
    }
  } catch (err) {
    console.error("Error scanning serial ports:", err.message);
  }
}

// Automatically scan for the ESP32 every 2 seconds (supports live plug-and-play)
setInterval(scanAndConnectESP32, 2000);
scanAndConnectESP32();

server.listen(PORT, () => {
  console.log("====================================================");
  console.log(`🚀 SMART INSOLE DASHBOARD READY`);
  console.log(`👉 Open in browser: http://localhost:${PORT}`);
  console.log(`⚠️  Make sure Arduino Serial Monitor/Plotter is CLOSED`);
  console.log("====================================================");
});
