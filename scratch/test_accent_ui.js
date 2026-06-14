import { simulate } from '../src/physics/simulation.js';
import vehiclesData from '../src/data/vehicles.json' with { type: 'json' };
import enginesData from '../src/data/engines.json' with { type: 'json' };
import transmissionsData from '../src/data/transmissions.json' with { type: 'json' };

const v = vehiclesData.find(x => x.model === 'Accent Blue 1.4');
const defaultEngine = enginesData.find(e => e.engine_code === v.stock_engine_code);
const defaultTrans = transmissionsData.find(t => t.transmission_code === v.stock_transmission) || transmissionsData[0];

const car = {
  name: `${v.make} ${v.model}`,
  drivetrain: v.drivetrain_stock,
  transmissionType: 'Auto',
  hp: defaultEngine ? parseInt(defaultEngine.stock_hp_at_rpm) : v.stock_hp,
  torque: defaultEngine ? parseInt(defaultEngine.stock_torque_nm_at_rpm) : v.stock_torque_nm,
  weight: v.curb_weight_kg,
  nosShot: 0,
  engine: defaultEngine || enginesData[0],
  transmission: defaultTrans,
  top_speed_kmh: v.top_speed_kmh,
  hasLimiter: true
};

let mappedTqCurve = [];
if (car.engine && car.engine.torque_curve_rpm_points) {
  const stockHp = parseInt(car.engine.stock_hp_at_rpm) || 1;
  const stockTq = parseInt(car.engine.stock_torque_nm_at_rpm) || 1;
  const hpRatio = car.hp / stockHp;
  const tqRatio = car.torque / stockTq;
  const multiplier = Math.max(hpRatio, tqRatio);

  mappedTqCurve = car.engine.torque_curve_rpm_points.map(p => ({
    rpm: p.rpm,
    nm: p.nm * multiplier
  }));
}

const gearRatios = car.transmission?.gear_ratios || [3.5, 2.0, 1.4, 1.0, 0.8, 0.6];
const finalDrive = car.transmission?.final_drive_ratio || 3.5;
const shiftTime = car.transmission?.shift_time_ms || 100;
const eff = car.transmission?.efficiency_pct || 90;

const simConfig = {
  raceMode: '0-100',
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
  efficiencyPct: eff,
  mu: 1.0,
  tractionFactor: 0.8,
  temperatureC: 20,
  altitudeM: 0,
  torqueCurve: mappedTqCurve,
  nosShot: car.nosShot || 0,
  topSpeedKmh: car.hasLimiter !== false ? (car.top_speed_kmh || 350) : null
};

console.log('0-100:', simulate({...simConfig, raceMode: '0-100'}).elapsed_time_s);
console.log('200m:', simulate({...simConfig, raceMode: '200m'}).elapsed_time_s);
console.log('400m:', simulate({...simConfig, raceMode: '400m'}).elapsed_time_s);
