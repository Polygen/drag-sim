import { simulate } from '../src/physics/simulation.js';

export const baseConfig = {
  raceMode: '0-100',
  weightKg: 1150,
  weightDistFrontPct: 62,
  drivetrain: 'FWD',
  wheelbaseM: 2.5,
  cogHeightM: 0.5,
  dragCoefficient: 0.30,
  frontalAreaM2: 2.2,
  rollingResistanceCoefficient: 0.012,
  tireRadiusM: 0.32,
  redlineRpm: 7500,
  idleRpm: 800,
  launchRpm: 3800,
  gearRatios: [3.5, 2.0, 1.4, 1.0, 0.8, 0.6],
  finalDriveRatio: 3.5,
  shiftTimeMs: 100, // Best case auto
  efficiencyPct: 95, // Best case manual
  mu: 1.2, // VHT
  tractionFactor: 1.3, // Slick
  temperatureC: 20,
  altitudeM: 0,
  torqueCurve: [1000, 2000, 3000, 4000, 5000, 6000, 6500, 7000, 8000].map(rpm => {
    let nm = 0;
    const peakTqRpm = 4000;
    const peakHpRpm = 6500; 
    const tqAtPeakHp = (100 * 7120) / peakHpRpm; 
    
    if (rpm <= peakTqRpm) {
        nm = 133 * 0.7 + (133 * 0.3) * (rpm / peakTqRpm);
    } else if (rpm <= peakHpRpm) {
        const ratio = (rpm - peakTqRpm) / (peakHpRpm - peakTqRpm);
        nm = 133 - (133 - tqAtPeakHp) * ratio;
    } else {
        const ratio = (rpm - peakHpRpm) / (8000 - peakHpRpm);
        nm = tqAtPeakHp * (1 - ratio * 0.3);
    }
    return { rpm, nm };
  }),
  nosShot: 0,
  topSpeedKmh: 350
};

console.log('Absolute best case scenario (1150kg, VHT, Slick, Auto, 95% eff):', simulate(baseConfig).elapsed_time_s);

const config2 = { ...baseConfig, weightKg: 1000 };
console.log('1000kg, VHT, Slick:', simulate(config2).elapsed_time_s);

const config3 = { ...baseConfig, weightKg: 850 };
console.log('850kg, VHT, Slick:', simulate(config3).elapsed_time_s);
