import { simulate } from '../physics/simulation.js';

// Engine seçilmemiş araçlar için sentetik tork eğrisi üretir.
// (Eski MultiLaneCanvas fallback davranışının birebir kopyası.)
function buildSyntheticTorqueCurve(hp, torque) {
  return [1000, 2000, 3000, 4000, 5000, 6000, 6500, 7000, 8000].map((rpm) => {
    const peakTqRpm = 4000;
    const peakHpRpm = 6500;
    const tqAtPeakHp = (hp * 7120) / peakHpRpm;

    let nm;
    if (rpm <= peakTqRpm) {
      nm = torque * 0.7 + (torque * 0.3) * (rpm / peakTqRpm);
    } else if (rpm <= peakHpRpm) {
      const ratio = (rpm - peakTqRpm) / (peakHpRpm - peakTqRpm);
      nm = torque - (torque - tqAtPeakHp) * ratio;
    } else {
      const ratio = (rpm - peakHpRpm) / (8000 - peakHpRpm);
      nm = tqAtPeakHp * (1 - ratio * 0.3);
    }
    return { rpm, nm };
  });
}

// Gerçek engine verisi varsa HP/tork değişimine göre tork eğrisini ölçekler.
// Kullanıcı sadece HP'yi artırıp torku unutursa diye en büyük oranı baz alır.
function mapRealTorqueCurve(engine, hp, torque) {
  const stockHp = parseInt(engine.stock_hp_at_rpm) || 1;
  const stockTq = parseInt(engine.stock_torque_nm_at_rpm) || 1;
  const multiplier = Math.max(hp / stockHp, torque / stockTq);
  return engine.torque_curve_rpm_points.map((p) => ({ rpm: p.rpm, nm: p.nm * multiplier }));
}

function surfaceMu(surface) {
  if (surface === 'vht') return 1.2;
  if (surface === 'turkey_asphalt') return 0.7;
  return 1.0;
}

function tireTraction(tire) {
  if (tire === 'slick') return 1.3;
  if (tire === 'semi_slick') return 1.15;
  return 0.8;
}

// UI'da (SetupOptimizerPanel) multi-select için kullanılan opsiyon listeleri.
// simRunner.js tek doğruluk kaynağı — surfaceMu/tireTraction ile buradaki id'ler
// aynı kalmalı, yoksa UI seçimleri simülasyona yanlış yansır.
//
// ÖNEMLİ: id'ler App.jsx'teki <select> option value'larıyla birebir aynı
// olmalı, yoksa "Ekle" sonrası raceSettings'e yazılan değer dropdown'da
// görünmez ve yarış koşullarıyla test koşulları eşleşmez. 'default' gibi
// optimizer-içi jenerik id'ler burada YER ALMAMALI.
export const SURFACE_OPTIONS = [
  { id: 'vht', label: 'VHT (yapışkan pist)' },
  { id: 'good_asphalt', label: 'Kaliteli Asfalt' },
  { id: 'turkey_asphalt', label: 'Türkiye Asfaltı' }
];
export const TIRE_OPTIONS = [
  { id: 'slick', label: 'Slick (yumuşak, max tutunma)' },
  { id: 'semi_slick', label: 'Semi-Slick' },
  { id: 'street', label: 'Sokak Lastiği' }
];

// Bir araç + yarış ayarı için simülasyon motorunun beklediği config objesini üretir.
// Pure fonksiyon: aynı girdi = aynı çıktı. Hem canvas hem optimizer buradan beslenir.
export function buildSimConfig(car, raceSettings) {
  const torqueCurve =
    car.engine && car.engine.torque_curve_rpm_points
      ? mapRealTorqueCurve(car.engine, car.hp, car.torque)
      : buildSyntheticTorqueCurve(car.hp, car.torque);

  const gearRatios = car.transmission?.gear_ratios || [3.5, 2.0, 1.4, 1.0, 0.8, 0.6];
  const finalDrive = car.transmission?.final_drive_ratio || 3.5;
  const shiftTime =
    car.transmission?.shift_time_ms || (car.transmissionType === 'Auto' ? 100 : 300);
  const efficiency =
    car.transmission?.efficiency_pct || (car.transmissionType === 'Auto' ? 90 : 95);

  return {
    raceMode: raceSettings.mode,
    weightKg: car.weight,
    weightDistFrontPct: car.drivetrain === 'FWD' ? 62 : 50,
    drivetrain: car.drivetrain,
    wheelbaseM: 2.5,
    cogHeightM: 0.5,
    dragCoefficient: 0.30,
    frontalAreaM2: 2.2,
    rollingResistanceCoefficient: 0.012,
    tireRadiusM: 0.32,
    redlineRpm: car.engine?.redline_rpm || 7500,
    idleRpm: car.engine?.idle_rpm || 800,
    launchRpm: (car.engine?.idle_rpm || 800) + 3000,
    gearRatios,
    finalDriveRatio: finalDrive,
    shiftTimeMs: shiftTime,
    efficiencyPct: efficiency,

    mu: surfaceMu(raceSettings.surface),
    tractionFactor: tireTraction(raceSettings.tire),
    temperatureC: raceSettings.temperature ?? 20,
    altitudeM: raceSettings.altitude ?? 0,

    torqueCurve,
    nosShot: car.nosShot || 0,
    launchGear: car.launchGear || 1,
    topSpeedKmh: car.hasLimiter !== false ? car.top_speed_kmh || 350 : null
  };
}

// Bir aracı simüle eder ve time_series dahil tüm detayları döner.
// Animasyon ve debug için uygun; grid search'te KULLANMA (bellek şişer).
export function simulateRun(car, raceSettings) {
  return simulate(buildSimConfig(car, raceSettings));
}

// Hafif versiyon: sadece skor metriklerini döner, time_series atılır.
// Grid search için: 1000+ koşuda yüzlerce MB tasarruf.
export function simulateRunLight(car, raceSettings) {
  const r = simulate(buildSimConfig(car, raceSettings));
  return {
    elapsed_time_s: r.elapsed_time_s,
    speed_at_end_kmh: r.speed_at_end_kmh,
    split_60ft_s: r.split_60ft_s,
    split_330ft_s: r.split_330ft_s,
    total_slip_time_s: r.total_slip_time_s,
    gear_shifts: r.gear_shifts,
    nos_trigger: r.nos_trigger,
    slip_events: r.slip_events,
    mode_target_met: r.mode_target_met
  };
}
