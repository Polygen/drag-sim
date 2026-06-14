import { simulate } from '../src/physics/simulation.js';

const car = {
  hp: 100,
  torque: 133,
  weight: 1150,
  drivetrain: 'FWD',
};

// Torque curve for 1.4 Kappa MPI? Wait, if they select it from DB, we use the DB torque curve!
// Let's assume a realistic fallback curve for now, since it might not be in DB.
const mappedTqCurve = [1000, 2000, 3000, 4000, 5000, 6000, 6500].map(rpm => {
  let nm = 0;
  const peakTqRpm = 4000;
  const peakHpRpm = 6000; 
  const tqAtPeakHp = (car.hp * 7120) / peakHpRpm; 
  if (rpm <= peakTqRpm) nm = car.torque * 0.7 + (car.torque * 0.3) * (rpm / peakTqRpm);
  else if (rpm <= peakHpRpm) nm = car.torque - (car.torque - tqAtPeakHp) * ((rpm - peakTqRpm) / (peakHpRpm - peakTqRpm));
  else nm = tqAtPeakHp * (1 - ((rpm - peakHpRpm) / (7000 - peakHpRpm)) * 0.3);
  return { rpm, nm };
});

const simConfig = {
  raceMode: '0-100',
  weightKg: car.weight,
  weightDistFrontPct: 60,
  drivetrain: 'FWD',
  wheelbaseM: 2.6,
  cogHeightM: 0.5,
  dragCoefficient: 0.30,
  frontalAreaM2: 2.0,
  rollingResistanceCoefficient: 0.012,
  tireRadiusM: 0.32,
  redlineRpm: 6500,
  idleRpm: 800,
  launchRpm: 3800, 
  gearRatios: [2.68, 1.8, 1.3, 1, 0.75, 0.6],
  finalDriveRatio: 4,
  shiftTimeMs: 150,
  efficiencyPct: 88,
  mu: 1.0,
  tractionFactor: 0.8,
  temperatureC: 20,
  altitudeM: 0,
  torqueCurve: mappedTqCurve,
  nosShot: 0,
  topSpeedKmh: 183
};

const res = simulate(simConfig);
console.log(`0-100 km/h: ${res.elapsed_time_s} s`);
