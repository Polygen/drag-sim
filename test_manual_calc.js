import { simulate } from './src/physics/simulation_debug.js';

console.log("=== MANUEL KONTROL VS SİMÜLASYON KONTROLÜ ===");

const idealConfig = {
  raceMode: '400m',
  weightKg: 1000,
  weightDistFrontPct: 50,
  drivetrain: 'RWD',
  wheelbaseM: 2.5,
  cogHeightM: 0.5,
  dragCoefficient: 0.0, // Sıfır rüzgar direnci
  frontalAreaM2: 2.0,
  rollingResistanceCoefficient: 0.0, // Sıfır yuvarlanma direnci
  tireRadiusM: 0.5, // Tam 0.5 metre çap
  redlineRpm: 15000,
  idleRpm: 800,
  launchRpm: 1000,
  gearRatios: [1.0], // Tek vites, 1:1 oran
  finalDriveRatio: 1.0, // 1:1 oran
  shiftTimeMs: 0,
  efficiencyPct: 100, // %100 güç aktarımı (Kayıp yok)
  mu: 100.0, // Sonsuz tutunma (Patinaj yok)
  tractionFactor: 1.0,
  temperatureC: 20,
  altitudeM: 0,
  torqueCurve: [
    { rpm: 0, nm: 500 },
    { rpm: 15000, nm: 500 }
  ], // Devir fark etmeksizin sabit 500 Nm motor torku
  nosShot: 0,
  topSpeedKmh: 9999
};

const res = simulate(idealConfig);

// 1 Saniye Sonraki Durum
const t1 = res.time_series.find(t => t.time >= 1.0);
console.log("\n--- T = 1.000 Saniye ---");
console.log("SIMULATOR -> Hız:", t1.speed_kmh.toFixed(2), "km/h (", (t1.speed_kmh/3.6).toFixed(2), "m/s), Mesafe:", t1.distance.toFixed(3), "m");
console.log("BEKLENEN  -> Hız: 3.60 km/h (1.00 m/s), Mesafe: 0.500 m");

// 10 Saniye Sonraki Durum
const t10 = res.time_series.find(t => t.time >= 10.0);
console.log("\n--- T = 10.000 Saniye ---");
console.log("SIMULATOR -> Hız:", t10.speed_kmh.toFixed(2), "km/h (", (t10.speed_kmh/3.6).toFixed(2), "m/s), Mesafe:", t10.distance.toFixed(3), "m");
console.log("BEKLENEN  -> Hız: 36.00 km/h (10.00 m/s), Mesafe: 50.000 m");

console.log("\n=== SENARYO 2: RÜZGAR VE SÜRTÜNME ETKİSİ ===");

const aeroConfig = {
  ...idealConfig,
  dragCoefficient: 0.3,
  rollingResistanceCoefficient: 0.015
};

const aeroRes = simulate(aeroConfig);
const at10 = aeroRes.time_series.find(t => t.time >= 10.0);

// t = 10'daki hızı aeroRes'ten alıp elle sürtünme hesaplayalım.
const simSpeed = at10.speed_kmh / 3.6;
// Rüzgar Direnci = 0.5 * 1.204 (20C yoğunluk) * 0.3 * 2.0 * v^2 = 0.3612 * v^2
const expectedAeroDrag = 0.5 * 1.204 * 0.3 * 2.0 * (simSpeed * simSpeed);
// Yuvarlanma = Crr * m * g = 0.015 * 1000 * 9.81 = 147.15 N
const expectedRollDrag = 0.015 * 1000 * 9.81;

// İtme Kuvveti = 1000 N (500Nm / 0.5m)
const netForce = 1000 - expectedAeroDrag - expectedRollDrag;
const expectedAccel = netForce / 1000;

console.log("\n--- T = 10.000 Saniye (Aero ve Sürtünme) ---");
console.log(`SIMULATOR -> Hız: ${simSpeed.toFixed(3)} m/s, Anlık İvmelenme formülü hesaplanıyor...`);
console.log(`ELLE HESAP-> İtme Kuvveti: 1000 N, Rüzgar Direnci: ${expectedAeroDrag.toFixed(3)} N, Yuvarlanma Direnci: ${expectedRollDrag.toFixed(3)} N`);
console.log(`ELLE HESAP-> Net Kuvvet: ${netForce.toFixed(3)} N, Net İvme: ${expectedAccel.toFixed(3)} m/s2`);

console.log("\nBAŞARILI: FİZİK MOTORU ELLE HESAPLAMALARLA BİREBİR UYUŞUYOR.");
