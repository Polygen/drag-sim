import { simulate } from './simulation.js';

// Nissan GT-R R35 Test Verisi (Stok)
const gtrConfig = {
  weightKg: 1740,
  weightDistFrontPct: 53.0,
  drivetrain: 'AWD',
  wheelbaseM: 2.780,
  cogHeightM: 0.50,
  dragCoefficient: 0.27,
  frontalAreaM2: 2.25,
  rollingResistanceCoefficient: 0.012,
  tireRadiusM: 0.355, // 20 inç jant + lastik
  redlineRpm: 7000,
  idleRpm: 750,
  launchRpm: 4000, // Launch control devri
  gearRatios: [4.056, 2.301, 1.595, 1.248, 1.001, 0.796],
  finalDriveRatio: 3.700,
  shiftTimeMs: 150,
  efficiencyPct: 92,
  mu: 1.10, // Drag pisti
  tractionFactor: 0.94, // AWD elektronik
  airDensity: 1.225,
  torqueCurve: [
    {rpm: 1000, nm: 350},
    {rpm: 2000, nm: 425},
    {rpm: 3000, nm: 560},
    {rpm: 3200, nm: 588},
    {rpm: 5200, nm: 588},
    {rpm: 6000, nm: 560},
    {rpm: 6400, nm: 530},
    {rpm: 7000, nm: 465}
  ]
};

// Toyota Supra A80 Test Verisi (Stok)
const supraConfig = {
  weightKg: 1490,
  weightDistFrontPct: 53.0,
  drivetrain: 'RWD',
  wheelbaseM: 2.550,
  cogHeightM: 0.50,
  dragCoefficient: 0.31,
  frontalAreaM2: 1.88,
  rollingResistanceCoefficient: 0.012,
  tireRadiusM: 0.32,
  redlineRpm: 6800,
  idleRpm: 700,
  launchRpm: 3500,
  gearRatios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793],
  finalDriveRatio: 3.266,
  shiftTimeMs: 250,
  efficiencyPct: 96,
  mu: 1.10,
  tractionFactor: 0.91, // LSD
  airDensity: 1.225,
  torqueCurve: [
    {rpm: 1000, nm: 180},
    {rpm: 2000, nm: 200},
    {rpm: 3000, nm: 230},
    {rpm: 4000, nm: 285},
    {rpm: 5000, nm: 275},
    {rpm: 5600, nm: 260},
    {rpm: 6000, nm: 240},
    {rpm: 6800, nm: 200}
  ]
};

// BMW E36 328i Test Verisi (Stok)
const e36Config = {
  weightKg: 1395,
  weightDistFrontPct: 50.0,
  drivetrain: 'RWD',
  wheelbaseM: 2.700,
  cogHeightM: 0.52,
  dragCoefficient: 0.31,
  frontalAreaM2: 1.90,
  rollingResistanceCoefficient: 0.012,
  tireRadiusM: 0.315,
  redlineRpm: 6500,
  idleRpm: 700,
  launchRpm: 1500,
  gearRatios: [4.20, 2.49, 1.66, 1.24, 1.00],
  finalDriveRatio: 2.93,
  shiftTimeMs: 300,
  efficiencyPct: 95,
  mu: 1.05, // Sokak tipi lastik/yüzey
  tractionFactor: 0.65, // Open diff
  airDensity: 1.225,
  torqueCurve: [
    {rpm: 1000, nm: 210},
    {rpm: 2000, nm: 230},
    {rpm: 3000, nm: 260},
    {rpm: 3950, nm: 280},
    {rpm: 4500, nm: 275},
    {rpm: 5300, nm: 255},
    {rpm: 6000, nm: 220},
    {rpm: 6500, nm: 185}
  ]
};

console.log("=== FİZİK MOTORU TESTLERİ ===");

const resGTR = simulate(gtrConfig);
console.log(`\nNissan GT-R R35:`);
console.log(`Hedef 400m Süresi: 11.1 - 11.6 saniye`);
console.log(`Hesaplanan Süre: ${resGTR.elapsed_time_s} saniye`);
console.log(`400m Hızı: ${resGTR.speed_at_400m_kmh} km/h`);
console.log(`60ft Süresi: ${resGTR.split_60ft_s} saniye`);
console.log(`Toplam Patinaj Süresi: ${resGTR.total_slip_time_s} saniye`);
console.log(`Vites Değişimleri:`, resGTR.gear_shifts);

const resSupra = simulate(supraConfig);
console.log(`\nToyota Supra A80:`);
console.log(`Hedef 400m Süresi: 14.5 - 15.2 saniye`);
console.log(`Hesaplanan Süre: ${resSupra.elapsed_time_s} saniye`);
console.log(`400m Hızı: ${resSupra.speed_at_400m_kmh} km/h`);
console.log(`60ft Süresi: ${resSupra.split_60ft_s} saniye`);
console.log(`Toplam Patinaj Süresi: ${resSupra.total_slip_time_s} saniye`);

const resE36 = simulate(e36Config);
console.log(`\nBMW E36 328i:`);
console.log(`Hedef 400m Süresi: 15.0 - 15.8 saniye`);
console.log(`Hesaplanan Süre: ${resE36.elapsed_time_s} saniye`);
console.log(`400m Hızı: ${resE36.speed_at_400m_kmh} km/h`);
console.log(`60ft Süresi: ${resE36.split_60ft_s} saniye`);
console.log(`Toplam Patinaj Süresi: ${resE36.total_slip_time_s} saniye`);
