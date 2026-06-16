/**
 * Ana Simülasyon Motoru — Ultra Gelişmiş Fizik v2.0
 *
 * Entegre modeller:
 * - Lastik ısı dinamiği (tire thermal)
 * - Kafa kaldırma (wheelie) modeli
 * - Debriyaj slip + termal
 * - Turbo lag + boost modeli
 * - Forged motor güç limitleri
 * - Aerodinamik downforce (ön/arka ayrı)
 * - Sürücü kütlesi CG etkisi
 * - Diferansiyel tipi bazlı çekiş
 * - Hıza göre değişen yuvarlanma direnci
 * - Eğim (incline) direnci
 * - Rüzgar etkisi
 * - Genişletilmiş telemetri çıktısı
 *
 * dt = 0.001 saniye (1ms adım)
 */

import { calculateAeroDrag, calculateRollingResistance, calculateDownforce, calculateInclineForce, calculateAirDensity, GRAVITY } from './aerodynamics.js';
import { getTorqueAtRpm } from './torqueCurve.js';
import { calculateWeightTransfer, calculateDrivenNormalForce, calculateMaxTractionForce, calcDriverEffect, differentialFactor, calcGForce } from './tractionModel.js';
import { parseTireSize, updateTireThermal, calcThermalMu, initialTireTemp } from './tireModel.js';
import { calculateWheelie, effectiveFrontalArea } from './wheelieModel.js';
import { updateClutchThermal, calculateClutchSlip, clutchCapacityAtTemp } from './clutchModel.js';
import { calcEffectiveEnginePower, flywheelInertia } from './engineModel.js';

/**
 * Ana simülasyon fonksiyonu
 * @param {object} config - Tam araç + yarış konfigürasyonu
 * @returns {object} Simülasyon sonuçları
 */
export function simulate(config) {
  const dt             = 0.001;
  const targetDistance = 400.208; // 1/4 mil

  // ── Zaman & Durum Değişkenleri ──────────────────────────────
  let time_s          = 0;
  let distance_m      = 0;
  let speed_ms        = 0;
  let acceleration_ms2 = 0;

  let currentGearIndex = 0;
  let isShifting       = false;
  let shiftTimeRemaining = 0;

  // ── Telemetri & Veri ────────────────────────────────────────
  let slipTimeTotal  = 0;
  const slipEvents   = [];
  const gearShifts   = [];
  const timeSeries   = [];

  // Splits
  let split60ft    = 0;
  let split330ft   = 0;
  let split660ft   = 0;
  let split1000ft  = 0;

  // Peak değerler
  let peakGForce     = 0;
  let peakSpeedKmh   = 0;
  let totalSlipEnergyJ = 0;

  // ── Araç Temel Özellikleri ──────────────────────────────────
  const driverWeightKg = config.driverWeightKg || 80;
  const rawCarWeight   = config.weightKg;

  // Sürücü CG etkisi hesapla
  const driverEffect = calcDriverEffect(
    rawCarWeight,
    config.cogHeightM || 0.50,
    driverWeightKg,
    config.seatHeightM || 0.35,
    config.weightDistFrontPct || 50,
    config.seatPositionPct || 45
  );

  const weight          = driverEffect.totalWeightKg;
  const weightFrontPct  = driverEffect.effectiveWeightFrontPct;
  const cogHeight       = driverEffect.effectiveCogHeightM;

  const drivetrain      = config.drivetrain;
  const wheelbase       = config.wheelbaseM || 2.6;
  const diffType        = config.differentialType || 'lsd';

  // Lastik geometrisi
  const rearTireInfo  = parseTireSize(config.rearTireSize);
  const frontTireInfo = parseTireSize(config.frontTireSize || config.rearTireSize);
  const tireRadiusM   = rearTireInfo.radiusM;

  // Aerodinamik
  const baseCD         = config.dragCoefficient || 0.30;
  const baseCL         = config.liftCoefficient || 0.05; // Küçük downforce
  const frontalArea    = config.frontalAreaM2 || 2.2;
  const crr            = config.rollingResistanceCoefficient || 0.012;
  const windSpeedMs    = config.windSpeedMs || 0;   // + = headwind
  const inclineDeg     = config.inclineDeg || 0;

  // Motor
  const torqueCurve    = config.torqueCurve;
  const redlineRpm     = config.redlineRpm || 7500;
  const idleRpm        = config.idleRpm || 800;
  const aspiration     = config.engineAspiration || 'NA';
  const maxBoostBar    = config.maxBoostBar || 0;
  const turboLagRpm    = config.turboLagRpm || 2000;
  const fullBoostRpm   = config.fullBoostRpm || 3500;
  const intercoolerType = config.intercoolerType || 'none';
  const fuelType       = config.fuelType || '95';
  const engineMods     = config.engineMods || {};
  const baseEngineInertia = config.engineInertiaKgm2 || 0.25;
  const flywheelType   = config.flywheelType || 'standard';
  const engineInertia  = flywheelInertia(flywheelType, baseEngineInertia);

  // Şanzıman
  const gearRatios     = config.gearRatios;
  const finalDrive     = config.finalDriveRatio;
  const shiftTimeMs    = config.shiftTimeMs;
  const efficiency     = config.efficiencyPct / 100;
  const shiftRpmThreshold = config.shiftRpmThreshold || 200; // Redline'dan kaç devir önce

  // Debriyaj kapasitesi (şanzıman bazlı)
  const baseClutchCapacityNm = config.clutchCapacityNm || (config.efficiencyPct ? 800 : 600);
  let clutchTempC = config.temperatureC || 20;

  // Çevresel faktörler
  const altitude      = config.altitudeM || 0;
  const tempC         = config.temperatureC !== undefined ? config.temperatureC : 20;
  const humidityPct   = config.humidityPct || 50;
  const airDensity    = calculateAirDensity(tempC, altitude, humidityPct);
  const pressurePa    = 101325 * Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
  const powerLossFactor = airDensity / 1.225;

  // Lastik sürtünme katsayısı
  const baseMu         = config.mu || 1.0;
  const diffTraction   = differentialFactor(diffType, drivetrain);
  const tireCompound   = config.tireCompound || null;
  const hasBurnout     = config.hasBurnout || false;

  // Başlangıç lastik sıcaklığı
  let tireTemp_rear_c  = initialTireTemp(tempC, hasBurnout, tireCompound);
  let tireTemp_front_c = tempC + 5;

  // Şanzıman
  const shiftTimeSec   = shiftTimeMs / 1000;

  // Yarış modu
  const mode           = config.raceMode || '400m';

  // Başlangıç RPM
  let engineRpm = config.launchRpm || (idleRpm + 2000);

  // 100-200 km/h başlangıç
  if (mode === '100-200') {
    speed_ms = 100 / 3.6;
    for (let g = 0; g < gearRatios.length; g++) {
      const wRpm = (speed_ms * 60) / (2 * Math.PI * tireRadiusM);
      const eRpm = wRpm * gearRatios[g] * finalDrive;
      if (eRpm > 3000 && eRpm < redlineRpm - 500) currentGearIndex = g;
    }
    const finalWheelRpm = (speed_ms * 60) / (2 * Math.PI * tireRadiusM);
    engineRpm = finalWheelRpm * gearRatios[currentGearIndex] * finalDrive;
  }

  // Wheelie durumu
  let wheelieAngleDeg    = 0;
  let wheelieTimeTotal   = 0;
  let hadWheelie         = false;

  // Top speed modu
  let timeAtConstantSpeed = 0;
  const maxSimulationTime = mode === 'Top Speed' ? 300 : 90;

  // ── ANA SİMÜLASYON DÖNGÜSÜ ─────────────────────────────────
  let isFinished = false;

  while (!isFinished && time_s < maxSimulationTime) {
    let slipPct   = 0;
    let appliedForce = 0;

    // 1. Vites değiştirme
    if (isShifting) {
      shiftTimeRemaining  -= dt;
      acceleration_ms2     = 0;
      if (shiftTimeRemaining <= 0) isShifting = false;

      // Vites sırasında lastikler soğur biraz
      tireTemp_rear_c  = Math.max(tempC, tireTemp_rear_c - 0.5 * dt);
      tireTemp_front_c = Math.max(tempC, tireTemp_front_c - 0.2 * dt);

    } else {
      // 2. RPM Hesaplama
      const wheelRpm     = (speed_ms * 60) / (2 * Math.PI * tireRadiusM);
      let calculatedRpm  = wheelRpm * gearRatios[currentGearIndex] * finalDrive;
      const targetLaunchRpm = config.launchRpm || (idleRpm + 2500);

      if (calculatedRpm < targetLaunchRpm && currentGearIndex === 0) {
        engineRpm = Math.max(calculatedRpm, targetLaunchRpm);
      } else if (calculatedRpm < idleRpm) {
        engineRpm = Math.max(calculatedRpm, idleRpm);
      } else {
        engineRpm = calculatedRpm;
      }

      // 3. Vites atma kararı
      if (engineRpm > redlineRpm - shiftRpmThreshold && currentGearIndex < gearRatios.length - 1) {
        gearShifts.push({ time: time_s, speed_kmh: speed_ms * 3.6, gear: currentGearIndex + 2 });
        currentGearIndex++;
        isShifting        = true;
        shiftTimeRemaining = shiftTimeSec;
        continue;
      }

      // 4. Tork & Motor Güç Modeli
      let revLimiterCut = engineRpm > redlineRpm;
      let rawTorque     = revLimiterCut ? 0 : getTorqueAtRpm(torqueCurve, engineRpm);

      // Motor güç modeli (turbo, yakıt, mods, rakım)
      const powerResult = calcEffectiveEnginePower({
        baseTorqueNm: rawTorque,
        engineRpm,
        aspiration,
        maxBoostBar,
        turboLagRpm,
        fullBoostRpm,
        intercoolerType,
        fuelType,
        mods: engineMods,
        powerLossFactor,
        atmosphericPressurePa: pressurePa
      });
      let engineTorque = powerResult.effectiveTorqueNm;

      // NOS
      const nosShotHp = config.nosShot || 0;
      const nosActivationSpeed = config.nosActivationSpeedKmh || 50;
      if (nosShotHp > 0 && currentGearIndex >= 1 && speed_ms * 3.6 > nosActivationSpeed) {
        const nosTorque = (nosShotHp * 7120.9) / Math.max(engineRpm, 3000);
        engineTorque += nosTorque;
      }

      // 5. Aerodinamik (hıza bağlı)
      // Wheelie açısı frontal alanı değiştirir
      const effectiveFA  = effectiveFrontalArea(frontalArea, wheelieAngleDeg);
      const aeroDrag     = calculateAeroDrag(airDensity, baseCD, effectiveFA, speed_ms, windSpeedMs);
      const downforce    = calculateDownforce(airDensity, baseCL + (config.wingDownforceCl || 0), effectiveFA, speed_ms);
      const rollingRes   = calculateRollingResistance(crr, weight, speed_ms);
      const inclineForce = calculateInclineForce(weight, inclineDeg);

      // 6. Debriyaj slip (kalkışta)
      const clutchCapacity = clutchCapacityAtTemp(baseClutchCapacityNm, clutchTempC);
      const wheelRpmForClutch = wheelRpm * gearRatios[currentGearIndex]; // Şanzıman giriş tarafı
      const engineRpmForClutch = engineRpm;
      const clutchResult = calculateClutchSlip(
        engineRpmForClutch,
        wheelRpmForClutch,
        engineTorque,
        clutchCapacity
      );

      // Debriyaj sıcaklık güncelle
      clutchTempC = updateClutchThermal(clutchTempC, clutchResult.heatPowerW, tempC, dt);

      // Aktarılan tork debriyaj kaymasıyla sınırlanmış olabilir
      const transmittedEngineTorque = speed_ms < 5 ? clutchResult.transmittedTorqueNm : engineTorque;

      // 7. Tekerlek torku & kuvveti
      const wheelTorque    = transmittedEngineTorque * gearRatios[currentGearIndex] * finalDrive * efficiency;
      const grossWheelForce = wheelTorque / tireRadiusM;

      // 8. Ağırlık transferi (önceki adımın ivmesiyle)
      const weightTransfer = calculateWeightTransfer(weight, Math.max(0, acceleration_ms2), cogHeight, wheelbase);
      const drivenNormalForce = calculateDrivenNormalForce(
        weight, weightFrontPct, drivetrain, weightTransfer,
        downforce.frontDownforceN, downforce.rearDownforceN
      );

      // 9. Lastik termal mu
      const thermalMu = calcThermalMu(tireCompound, tireTemp_rear_c, baseMu);
      const maxTractionForce = calculateMaxTractionForce(drivenNormalForce, thermalMu, diffTraction);

      // 10. Patinaj kontrolü
      appliedForce = grossWheelForce;
      if (grossWheelForce > maxTractionForce) {
        appliedForce = maxTractionForce;
        slipPct      = Math.min(100, ((grossWheelForce - maxTractionForce) / grossWheelForce) * 100);
        slipTimeTotal += dt;

        // Patinaj enerjisi (yanan lastik)
        const slipForceN  = grossWheelForce - maxTractionForce;
        const slipSpeedMs = speed_ms * (slipPct / 100);
        totalSlipEnergyJ += slipForceN * slipSpeedMs * dt;

        // Patinaj sırasında lastik ısınıyor
        tireTemp_rear_c = updateTireThermal(
          tireTemp_rear_c,
          slipForceN,
          slipSpeedMs,
          tempC,
          tireCompound,
          dt
        );

        if (timeSeries.length % 50 === 0) {
          slipEvents.push({ distance: distance_m, time: time_s, pct: slipPct });
        }
        if (speed_ms < 10) engineRpm = Math.max(engineRpm, targetLaunchRpm);

      } else {
        // Patinaj yokken lastik yavaş soğur
        tireTemp_rear_c = Math.max(tempC + 5, tireTemp_rear_c - 0.3 * dt);
      }

      // Ön lastikler yalnızca aerodinami ve fren ısısından etkilenir
      tireTemp_front_c = Math.max(tempC + 3, tireTemp_front_c - 0.1 * dt);

      // 11. Wheelie modeli
      const wheelieResult = calculateWheelie({
        tractionForceN: appliedForce,
        totalWeightKg: weight,
        weightFrontPct,
        cogHeightM: cogHeight,
        wheelbaseM: wheelbase,
        currentWheelieAngle: wheelieAngleDeg,
        drivetrain,
        speedMs: speed_ms
      }, dt);

      wheelieAngleDeg = wheelieResult.wheelieAngleDeg;
      if (wheelieResult.isWheelie) {
        wheelieTimeTotal += dt;
        hadWheelie = true;
        // AWD'de wheelie traksiyon kayıplusu
        if (drivetrain === 'AWD') {
          appliedForce *= (1 - wheelieResult.tractionReductionPct / 100);
        }
      }

      // 12. Dönen kütle ataleti
      const overallRatio  = gearRatios[currentGearIndex] * finalDrive;
      // Motor ataletini dingil milindeki eşdeğer kütleye çevir
      const rotInertiaEquivMass = (engineInertia * overallRatio * overallRatio) / (tireRadiusM * tireRadiusM);
      const inertiaFactor = 1 + rotInertiaEquivMass / weight;
      const dynamicMass   = weight * Math.min(1.25, inertiaFactor);

      // 13. Net kuvvet & ivme
      const netForce = appliedForce - aeroDrag - rollingRes - inclineForce;
      acceleration_ms2 = netForce / dynamicMass;

      // G kuvveti
      const gForce = Math.abs(calcGForce(acceleration_ms2));
      if (gForce > peakGForce) peakGForce = gForce;
    }

    // 14. Hız & mesafe güncelle
    speed_ms = Math.max(0, speed_ms + acceleration_ms2 * dt);

    // Top speed limiter
    const maxSpeedMs = config.topSpeedKmh ? config.topSpeedKmh / 3.6 : 1000;
    if (speed_ms > maxSpeedMs) {
      speed_ms = maxSpeedMs;
      acceleration_ms2 = 0;
    }

    distance_m += speed_ms * dt;
    time_s     += dt;

    const currentSpeedKmh = speed_ms * 3.6;
    if (currentSpeedKmh > peakSpeedKmh) peakSpeedKmh = currentSpeedKmh;

    // 15. Bitiş koşulları
    if (mode === '200m' && distance_m >= 200)  isFinished = true;
    if (mode === '400m' && distance_m >= 400)  isFinished = true;
    if (mode === '800m' && distance_m >= 800)  isFinished = true;
    if (mode === '0-100' && currentSpeedKmh >= 100)   isFinished = true;
    if (mode === '100-200' && currentSpeedKmh >= 200) isFinished = true;
    if (mode === 'Top Speed') {
      if (acceleration_ms2 <= 0.05 && currentSpeedKmh > 50) {
        timeAtConstantSpeed += dt;
        if (timeAtConstantSpeed > 2.0) isFinished = true;
      } else {
        timeAtConstantSpeed = 0;
      }
    }

    // 16. Split noktaları
    if (split60ft   === 0 && distance_m >= 18.288) split60ft   = time_s;
    if (split330ft  === 0 && distance_m >= 100.584) split330ft  = time_s;
    if (split660ft  === 0 && distance_m >= 201.168) split660ft  = time_s;
    if (split1000ft === 0 && distance_m >= 304.800) split1000ft = time_s;

    // 17. Zaman serisi kaydı (her 20ms)
    if (Math.round(time_s * 1000) % 20 === 0 || isFinished) {
      timeSeries.push({
        time:             parseFloat(time_s.toFixed(3)),
        distance:         parseFloat(distance_m.toFixed(2)),
        speed_kmh:        parseFloat(currentSpeedKmh.toFixed(1)),
        rpm:              Math.round(engineRpm),
        gear:             currentGearIndex + 1,
        slipPct:          Math.round(isShifting ? 0 : slipPct),
        accel_g:          parseFloat((acceleration_ms2 / GRAVITY).toFixed(3)),
        tire_temp_rear_c: Math.round(tireTemp_rear_c),
        tire_temp_front_c: Math.round(tireTemp_front_c),
        wheelie_deg:      parseFloat(wheelieAngleDeg.toFixed(1)),
        clutch_temp_c:    Math.round(clutchTempC),
      });
    }
  }

  // ── GROATHAUS ET TAHMİNİ ──────────────────────────────────
  // ET = 5.825 × (weight_lbs / hp)^(1/3)
  const weightLbs       = weight * 2.20462;
  const peakHp          = config.hp || 300;
  const groathausET     = 5.825 * Math.pow(weightLbs / peakHp, 1 / 3);

  return {
    elapsed_time_s:      parseFloat(time_s.toFixed(3)),
    speed_at_end_kmh:    parseFloat((speed_ms * 3.6).toFixed(1)),
    split_60ft_s:        parseFloat(split60ft.toFixed(3)),
    split_330ft_s:       parseFloat(split330ft.toFixed(3)),
    split_660ft_s:       parseFloat(split660ft.toFixed(3)),
    split_1000ft_s:      parseFloat(split1000ft.toFixed(3)),
    total_slip_time_s:   parseFloat(slipTimeTotal.toFixed(3)),
    total_slip_energy_kJ: parseFloat((totalSlipEnergyJ / 1000).toFixed(1)),
    gear_shifts:         gearShifts,
    slip_events:         slipEvents,
    time_series:         timeSeries,
    mode_target_met:     isFinished,
    wheelie_time_s:      parseFloat(wheelieTimeTotal.toFixed(3)),
    had_wheelie:         hadWheelie,
    peak_g_force:        parseFloat(peakGForce.toFixed(2)),
    peak_speed_kmh:      parseFloat(peakSpeedKmh.toFixed(1)),
    groathaus_et_s:      parseFloat(groathausET.toFixed(3)),
    final_tire_temp_rear_c:  Math.round(tireTemp_rear_c),
    final_clutch_temp_c:     Math.round(clutchTempC),
  };
}
