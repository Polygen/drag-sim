import { simulate } from '../src/physics/simulation.js';

const car = {
  hp: 100,
  torque: 133,
  weight: 1150,
  drivetrain: 'FWD',
};

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

// Mock the simulate function to test our new dynamic mass
function simulateTest(config) {
  const dt = 0.001;
  let time_s = 0;
  let distance_m = 0;
  let speed_ms = 0;
  let acceleration_ms2 = 0;
  let currentGearIndex = 0;
  
  const weight = config.weightKg + 80; // Sürücü
  const efficiency = config.efficiencyPct / 100;
  
  while (speed_ms * 3.6 < 100 && time_s < 30) {
    const wheelRpm = (speed_ms * 60) / (2 * Math.PI * config.tireRadiusM);
    let engineRpm = wheelRpm * config.gearRatios[currentGearIndex] * config.finalDriveRatio;
    engineRpm = Math.max(engineRpm, config.idleRpm);
    
    if (engineRpm > config.redlineRpm - 200 && currentGearIndex < config.gearRatios.length - 1) {
      currentGearIndex++;
      time_s += config.shiftTimeMs / 1000;
      continue;
    }
    
    let engineTorque = config.torqueCurve[config.torqueCurve.length-1].nm; // simplified lookup
    for(let i=0; i<config.torqueCurve.length-1; i++) {
        if(engineRpm >= config.torqueCurve[i].rpm && engineRpm <= config.torqueCurve[i+1].rpm) {
            const ratio = (engineRpm - config.torqueCurve[i].rpm) / (config.torqueCurve[i+1].rpm - config.torqueCurve[i].rpm);
            engineTorque = config.torqueCurve[i].nm + ratio * (config.torqueCurve[i+1].nm - config.torqueCurve[i].nm);
            break;
        }
    }
    
    const wheelTorque = engineTorque * config.gearRatios[currentGearIndex] * config.finalDriveRatio * efficiency;
    const grossWheelForce = wheelTorque / config.tireRadiusM;
    
    const aeroDrag = 0.5 * 1.225 * config.dragCoefficient * config.frontalAreaM2 * speed_ms * speed_ms;
    const rollingResistance = config.rollingResistanceCoefficient * weight * 9.81;
    
    const netForce = grossWheelForce - aeroDrag - rollingResistance;
    
    const overallRatio = config.gearRatios[currentGearIndex] * config.finalDriveRatio;
    const inertiaFactor = 1.04 + 0.0025 * (overallRatio * overallRatio);
    const dynamicMassEquivalent = weight * inertiaFactor;
    
    acceleration_ms2 = netForce / dynamicMassEquivalent;
    
    speed_ms += acceleration_ms2 * dt;
    distance_m += speed_ms * dt;
    time_s += dt;
  }
  return time_s;
}

console.log("With dynamic mass and 80kg driver:", simulateTest(simConfig));
