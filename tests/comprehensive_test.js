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

// Prepare results array
const anomalies = [];
const shiftTimeWarnings = [];

console.log('=== STARTING COMPREHENSIVE PHYSICS & MATH AUDIT ===\n');

for (const car of vehicles) {
  const engine = findEngine(car.stock_engine_code);
  const transmission = findTransmission(car.stock_transmission);

  if (!engine) {
    anomalies.push(`[MISSING ENGINE] ${car.make} ${car.model} is missing engine: ${car.stock_engine_code}`);
    continue;
  }
  if (!transmission) {
    anomalies.push(`[MISSING TRANSMISSION] ${car.make} ${car.model} is missing transmission: ${car.stock_transmission}`);
    continue;
  }

  // 1. Shift Time Audit
  // Manuals should be between 150-300ms for realistic sport shifting.
  // DCTs/Autos should be 50-150ms depending on era/software.
  const isAutoOrDCT = transmission.type.toLowerCase().includes('auto') || transmission.type.toLowerCase().includes('dct') || transmission.type.toLowerCase().includes('cvt');
  if (isAutoOrDCT && transmission.shift_time_ms > 250) {
    shiftTimeWarnings.push(`[SLOW AUTO/DCT] ${car.make} ${car.model} (${transmission.transmission_code}) shift time is ${transmission.shift_time_ms}ms. Too slow for modern software limits?`);
  } else if (!isAutoOrDCT && transmission.shift_time_ms < 100) {
    shiftTimeWarnings.push(`[UNREALISTIC MANUAL] ${car.make} ${car.model} (${transmission.transmission_code}) shift time is ${transmission.shift_time_ms}ms. Too fast for physical human shifts!`);
  }

  // 2. Max Theoretical Speed Calculation
  const tireRadiusM = 0.32; // Default if not specified in vehicle data
  const finalDrive = transmission.final_drive_ratio;
  const topGearRatio = transmission.gear_ratios[transmission.gear_ratios.length - 1];
  const redline = engine.redline_rpm;
  
  // Speed (km/h) = (RPM * 2 * PI * radius * 3.6) / (60 * Gear * Final)
  const theoreticalMaxSpeedKmh = (redline * 2 * Math.PI * tireRadiusM * 3.6) / (60 * topGearRatio * finalDrive);
  
  if (theoreticalMaxSpeedKmh < car.top_speed_kmh) {
    anomalies.push(`[TOP SPEED MISMATCH] ${car.make} ${car.model}: Declared Top Speed ${car.top_speed_kmh}km/h is physically IMPOSSIBLE. Gearbox maxes out at ${theoreticalMaxSpeedKmh.toFixed(1)}km/h at redline.`);
  }

  // 3. Simulating 0-400m
  const simConfig = {
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
    launchRpm: engine.idle_rpm + 2000, // simple launch
    gearRatios: transmission.gear_ratios,
    finalDriveRatio: transmission.final_drive_ratio,
    shiftTimeMs: transmission.shift_time_ms,
    efficiencyPct: transmission.efficiency_pct,
    mu: 1.0, // standard street
    tractionFactor: 0.8, // standard
    airDensity: 1.225,
    torqueCurve: engine.torque_curve_rpm_points,
    topSpeedKmh: car.top_speed_kmh,
    raceMode: '400m'
  };

  try {
    const result = simulate(simConfig);
    
    if (!result.mode_target_met) {
      anomalies.push(`[SIMULATION FAILED] ${car.make} ${car.model} failed to reach 400m in 60 seconds! Reached distance: ${result.time_series[result.time_series.length-1].distance}m. Likely math error or underpowered.`);
    }

    if (result.total_slip_time_s > 10) {
      anomalies.push(`[EXCESSIVE SLIP] ${car.make} ${car.model} slipped for ${result.total_slip_time_s}s. Traction logic might be flawed or torque is too high for tires.`);
    }
    
    // Check for negative speed
    const negativeSpeeds = result.time_series.filter(ts => ts.speed_kmh < 0);
    if (negativeSpeeds.length > 0) {
        anomalies.push(`[PHYSICS BUG] ${car.make} ${car.model} went backwards! Speeds: ${JSON.stringify(negativeSpeeds.map(ns => ns.speed_kmh))}`);
    }
    
    // Test 0-100 mode
    const simConfig100 = { ...simConfig, raceMode: '0-100' };
    const result100 = simulate(simConfig100);
    if (result100.mode_target_met && result100.elapsed_time_s < 1.5) {
      anomalies.push(`[UNREALISTIC ACCEL] ${car.make} ${car.model} did 0-100 in ${result100.elapsed_time_s}s. Too fast for a stock car.`);
    }

  } catch (error) {
    anomalies.push(`[SIMULATION CRASH] ${car.make} ${car.model}: ${error.message}`);
  }
}

console.log('--- SHIFT TIME WARNINGS ---');
shiftTimeWarnings.forEach(w => console.log(w));

console.log('\n--- PHYSICS AND MATH ANOMALIES ---');
if (anomalies.length === 0) {
  console.log('No severe physics anomalies detected. System is mathematically sound.');
} else {
  anomalies.forEach(a => console.log(a));
}

console.log('\n=== AUDIT COMPLETE ===');
