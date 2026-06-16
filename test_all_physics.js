import { simulate } from './src/physics/simulation.js';
import vehiclesData from './src/data/vehicles.json' with { type: 'json' };
import enginesData from './src/data/engines.json' with { type: 'json' };
import transmissionsData from './src/data/transmissions.json' with { type: 'json' };

const log = (msg) => console.log(msg);
const section = (title) => console.log(`\n================= ${title} =================`);

const getEngine = code => enginesData.find(e => e.engine_code === code);
const getTrans = code => transmissionsData.find(t => t.transmission_code === code);

function generateCurve(hp, tq) {
  return [1000, 2000, 3000, 4000, 5000, 6000, 6500, 7000, 8000].map(rpm => {
    let nm = 0;
    const peakTqRpm = 4000;
    const peakHpRpm = 6500;
    const tqAtPeakHp = (hp * 7120) / peakHpRpm;
    if (rpm <= peakTqRpm) {
       nm = tq * 0.7 + (tq * 0.3) * (rpm / peakTqRpm);
    } else if (rpm <= peakHpRpm) {
       const ratio = (rpm - peakTqRpm) / (peakHpRpm - peakTqRpm);
       nm = tq - (tq - tqAtPeakHp) * ratio;
    } else {
       const ratio = (rpm - peakHpRpm) / (8000 - peakHpRpm);
       nm = tqAtPeakHp * (1 - ratio * 0.3);
    }
    return { rpm, nm };
  });
}

const baseCarConfig = {
  raceMode: '400m',
  weightKg: 1500,
  weightDistFrontPct: 50,
  drivetrain: 'RWD',
  wheelbaseM: 2.5,
  cogHeightM: 0.5,
  dragCoefficient: 0.3,
  frontalAreaM2: 2.2,
  rollingResistanceCoefficient: 0.012,
  tireRadiusM: 0.32,
  redlineRpm: 7500,
  idleRpm: 800,
  launchRpm: 4000,
  gearRatios: [3.5, 2.0, 1.4, 1.0, 0.8, 0.6],
  finalDriveRatio: 3.5,
  shiftTimeMs: 250,
  efficiencyPct: 90,
  mu: 1.0, // VHT
  tractionFactor: 1.3, // Slick
  temperatureC: 20,
  altitudeM: 0,
  nosShot: 0,
  topSpeedKmh: 350,
};

section("TEST 1: 2000 HP CANAVAR - SOKAK LASTİĞİ vs VHT SLICK");
// 2000 HP, 2000 Nm RWD
let c1_street = { ...baseCarConfig, torqueCurve: generateCurve(2000, 2000), mu: 0.8, tractionFactor: 0.8 }; // Street
let c1_vht = { ...baseCarConfig, torqueCurve: generateCurve(2000, 2000), mu: 1.2, tractionFactor: 1.3 }; // VHT + Slick
let res1_st = simulate(c1_street);
let res1_vht = simulate(c1_vht);
log(`Street: ${res1_st.elapsed_time_s.toFixed(3)}s | Patinaj: ${res1_st.total_slip_time_s.toFixed(2)}s | 60ft: ${res1_st.split_60ft_s.toFixed(3)}s`);
log(`VHT   : ${res1_vht.elapsed_time_s.toFixed(3)}s | Patinaj: ${res1_vht.total_slip_time_s.toFixed(2)}s | 60ft: ${res1_vht.split_60ft_s.toFixed(3)}s`);

section("TEST 2: DRIVER STYLES (ŞOFÖR STİLLERİ)");
let c2_agg = { ...c1_vht, driverStyle: 'aggressive' };
let c2_bal = { ...c1_vht, driverStyle: 'balanced' };
let c2_sm  = { ...c1_vht, driverStyle: 'smooth' };
log(`Aggressive: ${simulate(c2_agg).elapsed_time_s.toFixed(3)}s (Vites Süresi ve Patinaj avantajlı)`);
log(`Balanced  : ${simulate(c2_bal).elapsed_time_s.toFixed(3)}s`);
log(`Smooth    : ${simulate(c2_sm).elapsed_time_s.toFixed(3)}s (Patinaj önlenir, vites yavaş)`);

section("TEST 3: 2. VİTESTE KALKIŞ EFEKTİ");
// Türkiye Asfaltında 1500 HP ile 1'de kalkmak vs 2'de kalkmak
let c3_base = { ...baseCarConfig, torqueCurve: generateCurve(1500, 1500), mu: 0.7, tractionFactor: 0.8 }; 
let c3_g1 = { ...c3_base, launchGear: 1 };
let c3_g2 = { ...c3_base, launchGear: 2 };
let r3_g1 = simulate(c3_g1);
let r3_g2 = simulate(c3_g2);
log(`1. Viteste Kalkış: ${r3_g1.elapsed_time_s.toFixed(3)}s | Patinaj: ${r3_g1.total_slip_time_s.toFixed(2)}s | 60ft: ${r3_g1.split_60ft_s.toFixed(3)}s`);
log(`2. Viteste Kalkış: ${r3_g2.elapsed_time_s.toFixed(3)}s | Patinaj: ${r3_g2.total_slip_time_s.toFixed(2)}s | 60ft: ${r3_g2.split_60ft_s.toFixed(3)}s`);

section("TEST 4: BOOST BY GEAR (VİTESE GÖRE GÜÇ)");
// Aynı Türkiye Asfaltında, 1'de ve 2'de limitli kalkmak
let c4_boost = { ...c3_base, launchGear: 1, boostByGear: { 1: 50, 2: 100 } };
let r4_boost = simulate(c4_boost);
log(`Limit YOK  (1500HP) : ${r3_g1.elapsed_time_s.toFixed(3)}s | Patinaj: ${r3_g1.total_slip_time_s.toFixed(2)}s | Hız: ${r3_g1.speed_at_end_kmh.toFixed(1)} km/h`);
log(`Limit VAR (1:50, 2:100): ${r4_boost.elapsed_time_s.toFixed(3)}s | Patinaj: ${r4_boost.total_slip_time_s.toFixed(2)}s | Hız: ${r4_boost.speed_at_end_kmh.toFixed(1)} km/h`);

section("TEST 5: FİZİK LİMİTLERİ VE ANOMALİ KONTROLÜ");
let c5_weak = { ...baseCarConfig, torqueCurve: generateCurve(50, 60), weightKg: 2500 }; 
let r5_weak = simulate(c5_weak);
log(`50 HP, 2500 kg Otobüs 400m süresi: ${r5_weak.elapsed_time_s.toFixed(3)}s (Gerçekçi mi? Normalde ~25-30 saniye sürer)`);

let c5_op = { ...baseCarConfig, torqueCurve: generateCurve(5000, 5000), weightKg: 800, mu: 2.0, tractionFactor: 2.0 };
let r5_op = simulate(c5_op);
log(`5000 HP, 800kg F1 aracı 400m: ${r5_op.elapsed_time_s.toFixed(3)}s | Hız: ${r5_op.speed_at_end_kmh.toFixed(1)} km/h (Maks Hız Limiti 350'de durdu mu? ${r5_op.speed_at_end_kmh <= 350.5})`);

section("TEST 6: DEVİR KESİCİDE (REDLINE) KALMA DURUMU");
let c6_short = { ...baseCarConfig, torqueCurve: generateCurve(1000, 1000), finalDriveRatio: 6.5 }; // Çok kısa şanzıman
let r6_short = simulate(c6_short);
log(`Kısa Şanzıman Bitiş Vitesi: ${r6_short.time_series[r6_short.time_series.length-1].gear} | Devir: ${r6_short.time_series[r6_short.time_series.length-1].rpm.toFixed(0)}`);
log(`Süre: ${r6_short.elapsed_time_s.toFixed(3)}s (Son hıza ulaşamayıp kesicide asılı kalmalı)`);

section("TEST 7: HAFİFLETME VS GÜÇ");
let c7_base = { ...baseCarConfig, torqueCurve: generateCurve(1000, 1000), weightKg: 1500, mu: 0.9, tractionFactor: 1.0 };
let c7_power = { ...c7_base, torqueCurve: generateCurve(1200, 1150) };
let c7_weight = { ...c7_base, weightKg: 1350 };
log(`Base:   ${simulate(c7_base).elapsed_time_s.toFixed(3)}s`);
log(`+200HP: ${simulate(c7_power).elapsed_time_s.toFixed(3)}s`);
log(`-150kg: ${simulate(c7_weight).elapsed_time_s.toFixed(3)}s`);

console.log("\nTEST BİTTİ.");
