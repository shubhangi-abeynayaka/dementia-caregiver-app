const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://broker.hivemq.com:1883');
const topic = 'orbitcare/location';

let currentLat = 6.9271;
let currentLng = 79.8612;

client.on('connect', () => {
  console.log('[Mock Hardware] Connected to public MQTT broker');

  setInterval(() => {
    currentLat += (Math.random() * 2 - 1) * 0.0001;
    currentLng += (Math.random() * 2 - 1) * 0.0001;

    const lat = Number(currentLat.toFixed(6));
    const lng = Number(currentLng.toFixed(6));
    const rssi = Math.floor(Math.random() * 21) - 80;
    const payload = JSON.stringify({
      device_id: 'patient-device-01',
      lat,
      lng,
      status: 'SAFE',
      rssi,
    });

    client.publish(topic, payload, (error) => {
      if (error) {
        console.error('[Mock Hardware Error]', error.message);
        return;
      }

      console.log(`[Mock Hardware] Published location: ${lat}, ${lng}`);
    });
  }, 3000);
});

client.on('error', (error) => {
  console.error('[Mock Hardware Error]', error.message);
});
