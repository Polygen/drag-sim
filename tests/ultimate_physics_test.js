import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulate } from '../src/physics/simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, '../src/data');
const vehicles = JSON.parse(fs.readFileSync(path.join(dataPath, 'vehicles.json'), 'utf-8'));
const engines = JSON.parse(fs.readFileSync(path.join(dataPath, 'engines.json'), 'utf-8'));
const transmissions = JSON.parse(fs.readFileSync(path.join(dataPath, 'transmissions.json'), 'utf-8'));

function findEngine(code) { return engines.find(e => e.engine_code === code); }
function findTransmission(code) { return transmissions.find(t => t.transmission_code === code); }

const errors = [];
const aeroWarnings = [];

console.log('=== ULTIMATE PHYSICS TEST: DYNO & AERO LIMITS ===\n');

for (const car of vehicles) {
  const engine = findEngine(car.stock_engine_code);
  const transmission = findTransmission(car.stock_transmission);

  if (!engine || !transmission) continue;

  // 1. Dyno Peak Validation
  let maxCalculatedHp = 0;
  let maxCalculatedNm = 0;
  
  for (const tPoint of engine.torque_curve_rpm_points) {
     if (tPoint.nm > maxCalculatedNm) maxCalculatedNm = tPoint.nm;
     const hp = (tPoint.nm * tPoint.rpm) / 7120.9;
     if (hp > maxCalculatedHp) maxCalculatedHp = hp;
  }
  
  const declaredHp = car.stock_hp;
  const declaredNm = car.stock_torque_nm;
  
  if (Math.abs(maxCalculatedHp - declaredHp) > 5) {
     errors.push(`[DYNO MISMATCH] ${car.model}: Catalog claims ${declaredHp} HP, but Engine Curve peaks at ${Math.round(maxCalculatedHp)} HP.`);
  }
  if (Math.abs(maxCalculatedNm - declaredNm) > 5) {
     errors.push(`[DYNO MISMATCH] ${car.model}: Catalog claims ${declaredNm} Nm, but Engine Curve peaks at ${Math.round(maxCalculatedNm)} Nm.`);
  }

  // 2. Aerodynamic Power Wall Logic
  // Required Power (Watts) = (Aero Drag + Rolling Resistance) * velocity_ms
  const topSpeedMs = car.top_speed_kmh / 3.6;
  const frontalArea = car.frontal_area_m2 || 2.0;
  const dragCoef = car.aero_drag_coefficient || 0.30;
  const airDensity = 1.225;
  const weight = car.curb_weight_kg;
  const crr = 0.012;
  const gravity = 9.81;
  
  const aeroDragN = 0.5 * airDensity * dragCoef * frontalArea * (topSpeedMs * topSpeedMs);
  const rollingResN = crr * weight * gravity;
  
  const totalResistanceN = aeroDragN + rollingResN;
  const requiredPowerWatts = totalResistanceN * topSpeedMs;
  const requiredHp = requiredPowerWatts / 745.7; // 1 HP = 745.7 Watts
  
  // Factor in drivetrain efficiency
  const wheelHpAvailable = maxCalculatedHp * (transmission.efficiency_pct / 100);
  
  if (requiredHp > wheelHpAvailable) {
      aeroWarnings.push(`[AERO WALL DEFIED] ${car.model}: Needs ${Math.round(requiredHp)} WHP to reach ${car.top_speed_kmh}km/h, but only has ${Math.round(wheelHpAvailable)} WHP available! Top Speed is physically impossible.`);
  } else {
      // It is possible! Let's simulate to V-Max (Top Speed mode) to see what it actually reaches
      const simConfig = {
        weightKg: car.curb_weight_kg,
        weightDistFrontPct: car.weight_distribution_front_pct || 50,
        drivetrain: car.drivetrain_stock,
        wheelbaseM: (car.wheelbase_mm || 2600) / 1000,
        cogHeightM: 0.5,
        dragCoefficient: dragCoef,
        frontalAreaM2: frontalArea,
        rollingResistanceCoefficient: crr,
        tireRadiusM: 0.32,
        redlineRpm: engine.redline_rpm,
        idleRpm: engine.idle_rpm,
        launchRpm: engine.idle_rpm + 2000,
        gearRatios: transmission.gear_ratios,
        finalDriveRatio: transmission.final_drive_ratio,
        shiftTimeMs: transmission.shift_time_ms,
        efficiencyPct: transmission.efficiency_pct,
        mu: 1.0, 
        tractionFactor: 0.8,
        airDensity: 1.225,
        torqueCurve: engine.torque_curve_rpm_points,
        topSpeedKmh: 1000, // Remove artificial limiter to see natural limit
        raceMode: 'Top Speed'
      };
      
      try {
        const res = simulate(simConfig);
        const reachedSpeedKmh = res.speed_at_end_kmh || (res.time_series[res.time_series.length - 1].speed_kmh);
        if (Math.abs(reachedSpeedKmh - car.top_speed_kmh) > 15) {
           aeroWarnings.push(`[SIMULATED V-MAX MISMATCH] ${car.model}: Catalog claims ${car.top_speed_kmh}km/h. Physical simulation reached ${reachedSpeedKmh.toFixed(1)}km/h.`);
        }
      } catch(e) {
        errors.push(`[SIM CRASH] ${car.model}: ${e.message}`);
      }
  }
}

console.log('--- DYNO ERRORS ---');
errors.forEach(e => console.log(e));
if (errors.length === 0) console.log('None.');

console.log('\n--- AERODYNAMIC & V-MAX WARNINGS ---');
aeroWarnings.forEach(w => console.log(w));
if (aeroWarnings.length === 0) console.log('None.');

console.log('\n=== ULTIMATE TEST COMPLETE ===');
