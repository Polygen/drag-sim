import { simulate } from './simulation.js';

export async function runPowerWeightAnalysis(carConfig, mode, surfaceId, tireId, hpAdd = 200, tqAdd = 150, weightDrop = 150) {
  let surfaceMu = 1.0;
  if (surfaceId === 'vht') surfaceMu = 1.2;
  if (surfaceId === 'turkey_asphalt') surfaceMu = 0.7;

  let tireMu = 1.0;
  if (tireId === 'slick') tireMu = 1.3;
  if (tireId === 'semi_slick') tireMu = 1.15;
  if (tireId === 'street') tireMu = 0.8;

  const parseValue = (val) => {
    if (!val) return 1;
    if (typeof val === 'string') return parseInt(val.split('@')[0]) || 1;
    return val;
  };
  const currentHp = parseValue(carConfig.hp);
  const currentTq = parseValue(carConfig.torque);
  const currentWeight = parseValue(carConfig.weight);

  const getMappedCurve = (targetHp, targetTq) => {
    let mappedTqCurve = [];
    if (carConfig.engine && carConfig.engine.torque_curve_rpm_points) {
      const stockHp = parseInt(carConfig.engine.stock_hp_at_rpm) || 1;
      const stockTq = parseInt(carConfig.engine.stock_torque_nm_at_rpm) || 1;
      const hpRatio = targetHp / stockHp;
      const tqRatio = targetTq / stockTq;
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
        const tqAtPeakHp = (targetHp * 7120) / peakHpRpm;
        if (rpm <= peakTqRpm) {
           nm = targetTq * 0.7 + (targetTq * 0.3) * (rpm / peakTqRpm);
        } else if (rpm <= peakHpRpm) {
           const ratio = (rpm - peakTqRpm) / (peakHpRpm - peakTqRpm);
           nm = targetTq - (targetTq - tqAtPeakHp) * ratio;
        } else {
           const ratio = (rpm - peakHpRpm) / (8000 - peakHpRpm);
           nm = tqAtPeakHp * (1 - ratio * 0.3);
        }
        return { rpm, nm };
      });
    }
    return mappedTqCurve;
  };

  const gearRatios = carConfig.transmission?.gear_ratios || [3.5, 2.0, 1.4, 1.0, 0.8, 0.6];
  const finalDrive = carConfig.transmission?.final_drive_ratio || 3.5;
  const shiftTime = carConfig.transmission?.shift_time_ms || (carConfig.transmissionType === 'Auto' ? 100 : 300);
  const eff = carConfig.transmission?.efficiency_pct || (carConfig.transmissionType === 'Auto' ? 90 : 95);
  const redlineRpm = carConfig.engine?.redline_rpm || 7500;
  const idleRpm = carConfig.engine?.idle_rpm || 800;
  const launchRpm = Math.max(1000, redlineRpm * 0.45);

  const getBaseConfig = (overrideWeight, overrideHp, overrideTq) => {
    return {
      raceMode: mode,
      weightKg: overrideWeight,
      weightDistFrontPct: carConfig.drivetrain === 'FWD' ? 62 : 50,
      drivetrain: carConfig.drivetrain,
      wheelbaseM: 2.5,
      cogHeightM: 0.5,
      dragCoefficient: 0.30,
      frontalAreaM2: 2.2,
      rollingResistanceCoefficient: 0.012,
      tireRadiusM: 0.32,
      redlineRpm,
      idleRpm,
      launchRpm,
      gearRatios,
      finalDriveRatio: finalDrive,
      shiftTimeMs: shiftTime,
      efficiencyPct: eff,
      mu: surfaceMu,
      tractionFactor: tireMu,
      temperatureC: 20,
      altitudeM: 0,
      torqueCurve: getMappedCurve(overrideHp, overrideTq),
      nosShot: 0,
      topSpeedKmh: carConfig.hasLimiter !== false ? (carConfig.top_speed_kmh || 350) : null,
      boostByGear: carConfig.boostByGear || null
    };
  };

  const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

  // 1. Mevcut Durum (Base)
  const baseRes = simulate(getBaseConfig(currentWeight, currentHp, currentTq));
  await yieldToMain();

  // 2. Güç Eklenmiş Durum (+200 HP)
  const powerRes = simulate(getBaseConfig(currentWeight, currentHp + hpAdd, currentTq + tqAdd));
  await yieldToMain();

  // 3. Hafifletilmiş Durum (-150 kg)
  // Ağırlık 500kg altına düşmemeli fiziksel kısıt
  const newWeight = Math.max(500, currentWeight - weightDrop);
  const weightRes = simulate(getBaseConfig(newWeight, currentHp, currentTq));

  return {
    base: {
      time: baseRes.elapsed_time_s,
      speed: baseRes.speed_at_end_kmh,
      split60: baseRes.split_60ft_s,
      slip: baseRes.total_slip_time_s
    },
    powerAdded: {
      time: powerRes.elapsed_time_s,
      speed: powerRes.speed_at_end_kmh,
      split60: powerRes.split_60ft_s,
      slip: powerRes.total_slip_time_s,
      hp: currentHp + hpAdd,
      tq: currentTq + tqAdd,
      weight: currentWeight
    },
    weightReduced: {
      time: weightRes.elapsed_time_s,
      speed: weightRes.speed_at_end_kmh,
      split60: weightRes.split_60ft_s,
      slip: weightRes.total_slip_time_s,
      hp: currentHp,
      tq: currentTq,
      weight: newWeight
    }
  };
}
