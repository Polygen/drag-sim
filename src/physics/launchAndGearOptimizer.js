import { simulate } from './simulation.js';

export async function runGearAndLaunchOptimization(carConfig, mode, surfaceId, tireId, progressCallback) {
  // Sabit Zemin ve Lastik (Çünkü bu analiz mevcut arabanın spesifik bir durumunda yapılıyor)
  let surfaceMu = 1.0;
  if (surfaceId === 'vht') surfaceMu = 1.2;
  if (surfaceId === 'turkey_asphalt') surfaceMu = 0.7;

  let tireMu = 1.0;
  if (tireId === 'slick') tireMu = 1.3;
  if (tireId === 'semi_slick') tireMu = 1.15;
  if (tireId === 'street') tireMu = 0.8;

  // Aracın tork eğrisi hazırlığı
  let mappedTqCurve = [];
  const parseValue = (val) => {
    if (!val) return 1;
    if (typeof val === 'string') return parseInt(val.split('@')[0]) || 1;
    return val;
  };
  const currentHp = parseValue(carConfig.hp);
  const currentTq = parseValue(carConfig.torque);

  if (carConfig.engine && carConfig.engine.torque_curve_rpm_points) {
    const stockHp = parseInt(carConfig.engine.stock_hp_at_rpm) || 1;
    const stockTq = parseInt(carConfig.engine.stock_torque_nm_at_rpm) || 1;
    const hpRatio = currentHp / stockHp;
    const tqRatio = currentTq / stockTq;
    const multiplier = Math.max(hpRatio, tqRatio);
    mappedTqCurve = carConfig.engine.torque_curve_rpm_points.map(p => ({
      rpm: p.rpm,
      nm: p.nm * multiplier
    }));
  } else {
    mappedTqCurve = [1000, 2000, 3000, 4000, 5000, 6000, 6500, 7000, 8000].map(rpm => {
      let nm = 0;
      const peakTqRpm = 4000;
      const peakHpRpm = 6500;
      const tqAtPeakHp = (currentHp * 7120) / peakHpRpm;
      if (rpm <= peakTqRpm) {
         nm = currentTq * 0.7 + (currentTq * 0.3) * (rpm / peakTqRpm);
      } else if (rpm <= peakHpRpm) {
         const ratio = (rpm - peakTqRpm) / (peakHpRpm - peakTqRpm);
         nm = currentTq - (currentTq - tqAtPeakHp) * ratio;
      } else {
         const ratio = (rpm - peakHpRpm) / (8000 - peakHpRpm);
         nm = tqAtPeakHp * (1 - ratio * 0.3);
      }
      return { rpm, nm };
    });
  }

  const redlineRpm = carConfig.engine?.redline_rpm || 7500;
  const idleRpm = carConfig.engine?.idle_rpm || 800;
  
  const gearRatios = carConfig.transmission?.gear_ratios || [3.5, 2.0, 1.4, 1.0, 0.8, 0.6];
  const shiftTime = carConfig.transmission?.shift_time_ms || (carConfig.transmissionType === 'Auto' ? 100 : 300);
  const eff = carConfig.transmission?.efficiency_pct || (carConfig.transmissionType === 'Auto' ? 90 : 95);

  const fdStart = 2.5;
  const fdEnd = 5.5;
  const fdStep = 0.1;

  const rpmStart = idleRpm + 500;
  const rpmEnd = redlineRpm - 500;
  const rpmStep = 250;

  const totalSteps = Math.floor((fdEnd - fdStart) / fdStep + 1) * Math.floor((rpmEnd - rpmStart) / rpmStep + 1);
  let currentStep = 0;

  let bestResult = null;
  let bestTime = Infinity;

  // Mevcut araç durumu (Karşılaştırma için)
  const currentFinalDrive = carConfig.transmission?.final_drive_ratio || 3.5;
  const currentLaunchRpm = Math.max(1000, redlineRpm * 0.45);
  let baseResult = null;

  const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

  // Önce base durumu hesapla
  const baseSimConfig = {
    raceMode: mode,
    weightKg: carConfig.weight,
    weightDistFrontPct: carConfig.drivetrain === 'FWD' ? 62 : 50,
    drivetrain: carConfig.drivetrain,
    wheelbaseM: 2.5,
    cogHeightM: 0.5,
    dragCoefficient: 0.30,
    frontalAreaM2: 2.2,
    rollingResistanceCoefficient: 0.012,
    tireRadiusM: 0.32,
    redlineRpm: redlineRpm,
    idleRpm: idleRpm,
    launchRpm: currentLaunchRpm,
    gearRatios,
    finalDriveRatio: currentFinalDrive,
    shiftTimeMs: shiftTime,
    efficiencyPct: eff,
    mu: surfaceMu,
    tractionFactor: tireMu,
    temperatureC: 20,
    altitudeM: 0,
    torqueCurve: mappedTqCurve,
    nosShot: carConfig.nosShot || 0,
    topSpeedKmh: carConfig.hasLimiter !== false ? (carConfig.top_speed_kmh || 350) : null
  };
  baseResult = simulate(baseSimConfig);


  // Grid araması
  for (let fd = fdStart; fd <= fdEnd; fd += fdStep) {
    for (let rpm = rpmStart; rpm <= rpmEnd; rpm += rpmStep) {
      
      const simConfig = {
        ...baseSimConfig,
        launchRpm: rpm,
        finalDriveRatio: fd
      };

      const res = simulate(simConfig);
      
      if (res.mode_target_met && res.elapsed_time_s < bestTime) {
        bestTime = res.elapsed_time_s;
        bestResult = {
          time: res.elapsed_time_s,
          speed: res.speed_at_end_kmh,
          slip: res.total_slip_time_s,
          launchRpm: rpm,
          finalDrive: fd,
          gearShifts: res.gear_shifts,
          finishGear: res.time_series[res.time_series.length - 1].gear,
          finishRpm: res.time_series[res.time_series.length - 1].rpm
        };
      }

      currentStep++;
    }
    if (progressCallback) progressCallback(currentStep / totalSteps);
    await yieldToMain();
  }

  return {
    base: {
      time: baseResult.elapsed_time_s,
      launchRpm: currentLaunchRpm,
      finalDrive: currentFinalDrive,
      finishGear: baseResult.time_series[baseResult.time_series.length - 1].gear,
      finishRpm: baseResult.time_series[baseResult.time_series.length - 1].rpm
    },
    optimized: bestResult
  };
}
