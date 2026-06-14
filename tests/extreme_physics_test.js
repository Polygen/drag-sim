import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulate } from '../src/physics/simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load data
const dataPath = path.join(__dirname, '../src/data');
const vehicles = JSON.parse(fs.readFileSync(path.join(dataPath, 'vehicles.json'), 'utf-8'));
const engines = JSON.parse(fs.readFileSync(path.join(dataPath, 'engines.json'), 'utf-8'));
const transmissions = JSON.parse(fs.readFileSync(path.join(dataPath, 'transmissions.json'), 'utf-8'));

function findEngine(code) {
  return engines.find(e => e.engine_code === code);
}

function findTransmission(code) {
  return transmissions.find(t => t.transmission_code === code);
}

const errors = [];
const warnings = [];

console.log('=== STARTING EXTREME PHYSICS & DATA AUDIT ===\n');

// 1. Database Integrity Checks
for (const engine of engines) {
  // A. Torque vs HP math check: HP = (Nm * RPM) / 7120.9
  if (engine.power_curve_rpm_points && engine.torque_curve_rpm_points) {
    if (engine.power_curve_rpm_points.length !== engine.torque_curve_rpm_points.length) {
       errors.push(`[ENGINE DATA] ${engine.engine_code}: Power and Torque curves have different point counts.`);
       continue;
    }
    for (let i = 0; i < engine.torque_curve_rpm_points.length; i++) {
       const tPoint = engine.torque_curve_rpm_points[i];
       const pPoint = engine.power_curve_rpm_points[i];
       if (tPoint.rpm !== pPoint.rpm) {
         errors.push(`[ENGINE DATA] ${engine.engine_code}: RPM mismatch at index ${i} (${tPoint.rpm} vs ${pPoint.rpm}).`);
       } else {
         const expectedHp = (tPoint.nm * tPoint.rpm) / 7120.9;
         // Tolerance of 2 HP due to rounding in standard docs
         if (Math.abs(expectedHp - pPoint.hp) > 2) {
            warnings.push(`[ENGINE DATA] ${engine.engine_code} at ${tPoint.rpm} RPM: HP is ${pPoint.hp}, but Math says it should be ${expectedHp.toFixed(1)} (Nm=${tPoint.nm}).`);
         }
       }
    }
  }

  // B. Redline vs Torque curve extent check
  const lastPoint = engine.torque_curve_rpm_points[engine.torque_curve_rpm_points.length - 1];
  if (lastPoint.rpm < engine.redline_rpm - 500) {
    warnings.push(`[ENGINE DATA] ${engine.engine_code}: Redline is ${engine.redline_rpm}, but torque curve ends at ${lastPoint.rpm}. The car will lack data at high RPM!`);
  }
}

for (const trans of transmissions) {
  // C. Gear ratio sanity check (monotonically decreasing)
  for (let i = 0; i < trans.gear_ratios.length - 1; i++) {
    if (trans.gear_ratios[i] <= trans.gear_ratios[i+1]) {
      errors.push(`[TRANS DATA] ${trans.transmission_code}: Gear ${i+1} (${trans.gear_ratios[i]}) is NOT greater than Gear ${i+2} (${trans.gear_ratios[i+1]}). Physics error!`);
    }
  }
}

// 2. Extreme Scenario Simulations & Frame-by-Frame Anomalies
for (const car of vehicles) {
  const engine = findEngine(car.stock_engine_code);
  const transmission = findTransmission(car.stock_transmission);

  if (!engine || !transmission) continue;

  const tireRadiusM = 0.32; // Standard

  const baseSimConfig = {
    weightKg: car.curb_weight_kg,
    weightDistFrontPct: car.weight_distribution_front_pct,
    drivetrain: car.drivetrain_stock,
    wheelbaseM: car.wheelbase_mm / 1000,
    cogHeightM: 0.5,
    dragCoefficient: car.aero_drag_coefficient,
    frontalAreaM2: car.frontal_area_m2,
    rollingResistanceCoefficient: 0.012,
    tireRadiusM: tireRadiusM,
    redlineRpm: engine.redline_rpm,
    idleRpm: engine.idle_rpm,
    launchRpm: engine.idle_rpm + 2500,
    gearRatios: transmission.gear_ratios,
    finalDriveRatio: transmission.final_drive_ratio,
    shiftTimeMs: transmission.shift_time_ms,
    efficiencyPct: transmission.efficiency_pct,
    mu: 1.0, 
    tractionFactor: 0.8,
    airDensity: 1.225,
    torqueCurve: engine.torque_curve_rpm_points,
    topSpeedKmh: car.top_speed_kmh,
    raceMode: '400m'
  };

  const scenarios = [
    { name: 'Standard', override: {} },
    { name: 'Wet Track', override: { mu: 0.5 } },
    { name: 'High Altitude', override: { airDensity: 0.9 } }, // less drag, less lift
  ];

  for (const s of scenarios) {
    const config = { ...baseSimConfig, ...s.override };
    try {
      const result = simulate(config);
      
      // D. Monotonic distance and time check
      let lastDistance = -1;
      let lastTime = -1;
      for (const frame of result.time_series) {
         if (frame.distance < lastDistance) {
           errors.push(`[SIMULATION BUG] ${car.model} in ${s.name}: Distance went backwards from ${lastDistance} to ${frame.distance}!`);
         }
         if (frame.time < lastTime) {
           errors.push(`[SIMULATION BUG] ${car.model} in ${s.name}: Time went backwards!`);
         }
         lastDistance = frame.distance;
         lastTime = frame.time;
      }

      // E. Split time logic validation
      if (result.split_60ft_s >= result.split_330ft_s || result.split_330ft_s >= result.elapsed_time_s) {
         if (result.mode_target_met) {
            errors.push(`[SIMULATION BUG] ${car.model} in ${s.name}: Split times are illogical! 60ft: ${result.split_60ft_s}, 330ft: ${result.split_330ft_s}, 400m: ${result.elapsed_time_s}`);
         }
      }

      // Track comparison
      if (s.name === 'Wet Track') {
         if (result.total_slip_time_s < 0.5) {
            warnings.push(`[PHYSICS ALERT] ${car.model} on Wet Track had very little slip (${result.total_slip_time_s}s). Is traction overperforming?`);
         }
      }

    } catch (e) {
      errors.push(`[CRASH] ${car.model} in ${s.name}: ${e.message}`);
    }
  }
}

console.log('--- ERRORS ---');
errors.forEach(e => console.log(e));
if (errors.length === 0) console.log('None.');

console.log('\n--- WARNINGS ---');
warnings.forEach(w => console.log(w));
if (warnings.length === 0) console.log('None.');

console.log('\n=== EXTREME AUDIT COMPLETE ===');
