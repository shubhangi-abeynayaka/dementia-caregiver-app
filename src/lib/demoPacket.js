// Demo mode simulator — generates fake packets cycling through states.
const center = { lat: 24.7135, lng: 46.6755 };
const outside = { lat: 24.7148, lng: 46.6768 };

export function startDemo(onPacket) {
  let phase = 0; // 0 SAFE, 1 ALERT, 2 SOS
  let step = 0;

  const cycle = () => {
    let lat, lng, status;
    if (phase === 0) {
      lat = center.lat + (Math.random() - 0.5) * 0.0002;
      lng = center.lng + (Math.random() - 0.5) * 0.0002;
      status = "SAFE";
    } else {
      lat = outside.lat + (Math.random() - 0.5) * 0.0001;
      lng = outside.lng + (Math.random() - 0.5) * 0.0001;
      status = phase === 1 ? "ALERT" : "SOS";
    }
    onPacket({
      status,
      lat,
      lng,
      rssi: -55 - Math.floor(Math.random() * 35),
      timestamp: Date.now(),
    });
    step++;
    if (step >= 4) {
      step = 0;
      phase = (phase + 1) % 3;
    }
  };

  cycle();
  const id = setInterval(cycle, 4000);
  return () => clearInterval(id);
}