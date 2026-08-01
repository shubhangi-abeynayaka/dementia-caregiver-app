// Web Bluetooth helper for the ESP32 LoRa receiver unit.
// Uses the Nordic UART-style service (common for ESP32 BLE serial).

const SERVICE_UUID = 0x6e400001; // Nordic UART Service
const TX_CHAR_UUID = 0x6e400002; // notifications (ESP32 -> app)
const RX_CHAR_UUID = 0x6e400003; // write (app -> ESP32), reserved

export function isWebBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

/**
 * Parses a text packet line, e.g.
 *   "STATUS:SAFE,LAT:24.7136,LNG:46.6753,RSSI:-72"
 */
export function parsePacket(line) {
  const parts = line.split(",");
  const obj = {};
  for (const p of parts) {
    const [k, ...rest] = p.split(":");
    obj[k.trim().toUpperCase()] = rest.join(":").trim();
  }
  if (!obj.STATUS) return null;
  const status = obj.STATUS.toUpperCase();
  if (!["SAFE", "ALERT", "SOS"].includes(status)) return null;
  return {
    status,
    lat: parseFloat(obj.LAT),
    lng: parseFloat(obj.LNG),
    rssi: obj.RSSI ? parseInt(obj.RSSI, 10) : null,
    timestamp: Date.now(),
  };
}

export async function connectBluetooth({ onPacket, onDisconnect, onError }) {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser.");
  }

  let device, server, characteristic;
  let buffer = "";

  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: ["generic_access"],
    });
    server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    characteristic = await service.getCharacteristic(TX_CHAR_UUID);

    const handler = (event) => {
      const value = event.target.value;
      let str = "";
      for (const c of value) str += String.fromCharCode(c);
      buffer += str;
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) {
          const packet = parsePacket(line);
          if (packet) onPacket(packet);
        }
      }
    };

    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", handler);

    device.addEventListener("gattserverdisconnected", () => {
      onDisconnect && onDisconnect();
    });

    return {
      device,
      disconnect() {
        try {
          characteristic.removeEventListener("characteristicvaluechanged", handler);
        } catch {}
        if (device.gatt && device.gatt.connected) {
          try {
            device.gatt.disconnect();
          } catch {}
        }
      },
    };
  } catch (e) {
    onError && onError(e);
    throw e;
  }
}