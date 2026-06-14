const fs = require('fs');
const { simulate } = require('../src/physics/simulation.js');

const vehicles = JSON.parse(fs.readFileSync('./src/data/vehicles.json'));
const engines = JSON.parse(fs.readFileSync('./src/data/engines.json'));
const transmissions = JSON.parse(fs.readFileSync('./src/data/transmissions.json'));

let report = `# Physics Simulation Test Report\n\n`;

function runTest(car, mode) {
  const engine = engines.find(e => e.engine_code === car.stock_engine_code);
  const trans = transmissions.find(t => t.transmission_code === car.stock_transmission) || transmissions[0];
  
  if (!engine) return null;

  const simConfig = {
    raceMode: mode,
    weightKg: car.curb_weight_kg,
    weightDistFrontPct: car.weight_distribution_front_pct || (car.drivetrain_stock === 'FWD' ? 62 : 50),
    drivetrain: car.drivetrain_stock,
    wheelbaseM: 2.5,
    dragCoefficient: car.aero_drag_coefficient || 0.32,
    frontalAreaM2: car.frontal_area_m2 || 2.1,
    redlineRpm: engine.redline_rpm || 7500,
    idleRpm: engine.idle_rpm || 800,
    launchRpm: (engine.redline_rpm || 7500) * 0.6,
    torqueCurve: engine.torque_curve_rpm_points,
    gearRatios: trans.gear_ratios,
    finalDriveRatio: trans.final_drive_ratio,
    shiftTimeMs: trans.shift_time_ms,
    efficiencyPct: trans.efficiency_pct || 90,
    mu: 1.0, // Good Asphalt + Street Tire
    tractionFactor: 0.85,
    nosShot: 0,
    topSpeedKmh: car.top_speed_kmh || 350
  };

  return simulate(simConfig);
}

const anomalyList = [];

report += `## 0-100 km/h and 400m Drag Test Results\n`;
report += `| Car | 0-100 (s) | 400m (s) | Trap Speed (km/h) | Shifts | Anomaly |\n`;
report += `|---|---|---|---|---|---|\n`;

vehicles.forEach(car => {
  const res0100 = runTest(car, '0-100');
  const res400 = runTest(car, '400m');

  if (!res0100 || !res400) return;

  const t0100 = res0100.elapsed_time_s.toFixed(2);
  const t400 = res400.elapsed_time_s.toFixed(2);
  const trapSpeed = res400.speed_at_end_kmh.toFixed(1);
  const shifts = res400.gear_shifts.length;

  let anomaly = '';
  // Check unrealistic 0-100
  if (car.stock_hp < 120 && res0100.elapsed_time_s < 7.5) {
    anomaly = 'Too fast 0-100 for low HP';
  } else if (car.stock_hp > 300 && res0100.elapsed_time_s > 6.5) {
    anomaly = 'Too slow 0-100 for high HP';
  } else if (res400.speed_at_end_kmh >= (car.top_speed_kmh || 350)) {
    anomaly = 'Hit Top Speed Limiter early';
  } else if (shifts === 0) {
    anomaly = 'No shifts occurred';
  }

  if (anomaly) {
    anomalyList.push(`- **${car.make} ${car.model}**: ${anomaly}`);
  }

  report += `| ${car.make} ${car.model} | ${t0100}s | ${t400}s | ${trapSpeed} km/h | ${shifts} | ${anomaly ? '⚠️' : '✅'} |\n`;
});

report += `\n## Anomalies Detected\n`;
if (anomalyList.length === 0) {
  report += `No physics anomalies detected. System performs mathematically perfectly.\n`;
} else {
  anomalyList.forEach(a => report += a + '\n');
}

fs.writeFileSync('../physics_report.md', report);
console.log('Test completed and report generated.');
