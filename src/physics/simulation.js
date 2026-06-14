import { calculateAeroDrag, calculateRollingResistance, GRAVITY } from './aerodynamics.js';
import { getTorqueAtRpm } from './torqueCurve.js';
import { calculateWeightTransfer, calculateDrivenNormalForce, calculateMaxTractionForce } from './tractionModel.js';

/**
 * Ana Simülasyon Motoru (0-400m)
 * Web Worker veya asenkron kullanılmak üzere tasarlanmıştır.
 * dt = 0.001 saniye (1ms)
 */
export function simulate(config) {
  const dt = 0.001;
  const targetDistance = 400.208; // 1 çeyrek mil = 400.208 metre

  let time_s = 0;
  let distance_m = 0;
  let speed_ms = 0;
  let acceleration_ms2 = 0;
  
  let currentGearIndex = 0; // 0-indexed (0 = 1. vites)
  let isShifting = false;
  let shiftTimeRemaining = 0;
  
  let slipTimeTotal = 0;
  const slipEvents = [];
  const gearShifts = [];
  const timeSeries = [];
  
  let split60ft = 0;
  let split330ft = 0;

  // Temel araç özellikleri
  const weight = config.weightKg + 80; // Sürücü ağırlığı eklendi
  const weightFrontPct = config.weightDistFrontPct;
  const drivetrain = config.drivetrain;
  const wheelbase = config.wheelbaseM;
  const cogHeight = config.cogHeightM || 0.5; // Tahmini 50cm
  const dragCoefficient = config.dragCoefficient;
  const frontalArea = config.frontalAreaM2;
  const crr = config.rollingResistanceCoefficient || 0.012; // Standart sokak
  const tireRadiusM = config.tireRadiusM || 0.32; // Standart 18-19 inç tekerlek

  // Motor özellikleri
  const torqueCurve = config.torqueCurve;
  const redlineRpm = config.redlineRpm;
  const idleRpm = config.idleRpm || 800;

  // Şanzıman özellikleri
  const gearRatios = config.gearRatios;
  const finalDrive = config.finalDriveRatio;
  const shiftTimeMs = config.shiftTimeMs;
  const efficiency = config.efficiencyPct / 100;

  // Yol ve Lastik
  const mu = config.mu || 1.0;
  const tractionFactor = config.tractionFactor || 0.8;
  
  // Çevresel Faktörler (Hava Yoğunluğu ve Rakım)
  const altitude = config.altitudeM || 0;
  const tempC = config.temperatureC !== undefined ? config.temperatureC : 20;
  const tempK = tempC + 273.15;
  // Barometrik basınç formülü
  const pressurePa = 101325 * Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
  const R_specific = 287.058;
  const airDensity = pressurePa / (R_specific * tempK); // Gerçek hava yoğunluğu
  
  // Motor güç kaybı (Yoğunluk oranına göre, düzeltme faktörü)
  // İnce havada güç düşer. 1.225 kg/m3 standarttır.
  const powerLossFactor = airDensity / 1.225; 

  const shiftTimeSec = shiftTimeMs / 1000;

  // Initial step setup
  let engineRpm = config.launchRpm || idleRpm;
  // Kalkış reaksiyon süresini şimdilik animasyon tarafına bırakıyoruz, burası fiziki hareketten başlıyor
  // Race Mode Ayarları
  const mode = config.raceMode || '400m'; // '400m', '0-100', '100-200'
  
  if (mode === '100-200') {
    speed_ms = 100 / 3.6; // 100 km/h = 27.77 m/s
    // Rolling start için uygun vitesi bul (örneğin devrin 3000 üzerinde kaldığı en yüksek vites)
    for (let g = 0; g < gearRatios.length; g++) {
      const wRpm = (speed_ms * 60) / (2 * Math.PI * tireRadiusM);
      const eRpm = wRpm * gearRatios[g] * finalDrive;
      if (eRpm > 3000 && eRpm < redlineRpm - 500) {
        currentGearIndex = g;
      }
    }
    const finalWheelRpm = (speed_ms * 60) / (2 * Math.PI * tireRadiusM);
    engineRpm = finalWheelRpm * gearRatios[currentGearIndex] * finalDrive;
  }

  // Top Speed modu için değişkenler
  let timeAtConstantSpeed = 0;
  const maxSimulationTime = mode === 'Top Speed' ? 300 : 60;

  // Ana simülasyon döngüsü
  let isFinished = false;
  while (!isFinished && time_s < maxSimulationTime) {
    let slipPct = 0;
    // 1. Vites değiştirme kontrolü
    if (isShifting) {
      shiftTimeRemaining -= dt;
      acceleration_ms2 = 0; // Vites değişirken boşluk, ivme yok
      if (shiftTimeRemaining <= 0) {
        isShifting = false;
      }
    } else {
      // 2. RPM Hesaplama ve Debriyaj / Tork Konvertörü Kayması
      const wheelRpm = (speed_ms * 60) / (2 * Math.PI * tireRadiusM);
      let calculatedRpm = wheelRpm * gearRatios[currentGearIndex] * finalDrive;
      
      // Debriyaj kavrama mantığı: Kalkışta tekerlek hızı düşükken debriyaj kaydırılır.
      // Launch RPM'e kadar debriyaj kaydırılarak devir yüksek tutulur.
      const targetLaunchRpm = config.launchRpm || (idleRpm + 2000);
      
      if (calculatedRpm < targetLaunchRpm && currentGearIndex === 0) {
        // 1. viteste ve hız düşükken debriyaj kaydırılıyor
        engineRpm = Math.max(calculatedRpm, targetLaunchRpm);
      } else if (calculatedRpm < idleRpm) {
        engineRpm = Math.max(calculatedRpm, idleRpm);
      } else {
        engineRpm = calculatedRpm;
      }

      // Vites Atma Kararı
      if (engineRpm > redlineRpm - 200 && currentGearIndex < gearRatios.length - 1) {
        gearShifts.push({ time: time_s, gear: currentGearIndex + 2 });
        currentGearIndex++;
        isShifting = true;
        shiftTimeRemaining = shiftTimeSec;
        continue;
      }

      // 3. Tork ve Brüt Kuvvet Hesaplama
      // Eğer araç son vitesteyse ve devir kesiciye (redline) girdiyse, mekanik olarak daha fazla hızlanamaz!
      let revLimiterCut = engineRpm > redlineRpm;
      let engineTorque = revLimiterCut ? 0 : getTorqueAtRpm(torqueCurve, engineRpm);
      
      // Sıcaklık ve Rakımdan kaynaklı oksijen kaybı/artışı güce yansır
      engineTorque *= powerLossFactor;
      
      const nosShotHp = config.nosShot || 0;
      if (nosShotHp > 0 && currentGearIndex >= 1 && speed_ms > 13.8) {
        const nosTorque = (nosShotHp * 7120) / Math.max(engineRpm, 3000);
        engineTorque += nosTorque;
      }

      const wheelTorque = engineTorque * gearRatios[currentGearIndex] * finalDrive * efficiency;
      const grossWheelForce = wheelTorque / tireRadiusM;

      // 4. Ağırlık Transferi ve Tutunum (Traction)
      // Fiziksel hata düzeltmesi: Ağırlık transferi, patinajdaki teorik devasa ivmeyle (potentialAccel) değil, 
      // aracın bir önceki adımda elde ettiği gerçek ivmesiyle (acceleration_ms2) hesaplanmalıdır.
      // İlk adımda ivme 0 olduğu için statik ağırlıkla başlar, hızlandıkça transfer artar.
      const weightTransfer = calculateWeightTransfer(weight, Math.max(0, acceleration_ms2), cogHeight, wheelbase);
      
      let drivenNormalForce = calculateDrivenNormalForce(weight, weightFrontPct, drivetrain, weightTransfer, 0);
      if (drivetrain === 'AWD') drivenNormalForce *= 1.1; 
      if (drivetrain === 'FWD') drivenNormalForce *= 0.9; 
      
      const maxTractionForce = drivenNormalForce * mu * tractionFactor;

      // 5. Patinaj Kontrolü
      let appliedForce = grossWheelForce;
      if (grossWheelForce > maxTractionForce) {
        appliedForce = maxTractionForce;
        slipPct = ((grossWheelForce - maxTractionForce) / grossWheelForce) * 100;
        slipTimeTotal += dt;
        
        if (timeSeries.length % 50 === 0) {
          slipEvents.push({ distance: distance_m, time: time_s, pct: slipPct });
        }
        
        // Patinaj anında devir yükselir (zaten wheelRpm veya debriyaj ile yüksek tutuluyor)
        if (speed_ms < 10) engineRpm = Math.max(engineRpm, targetLaunchRpm);
      }

      // 6. Dirençler
      const aeroDrag = calculateAeroDrag(airDensity, dragCoefficient, frontalArea, speed_ms);
      const rollingResistance = calculateRollingResistance(crr, weight);

      // 7. Net Kuvvet ve İvme
      const netForce = appliedForce - aeroDrag - rollingResistance;
      
      // Dönen kütle ataleti (Rotational inertia)
      // Vites oranı arttıkça motorun dönen kütlesinin yarattığı eylemsizlik artar
      const overallRatio = gearRatios[currentGearIndex] * finalDrive;
      const inertiaFactor = 1.04 + 0.0015 * (overallRatio * overallRatio);
      const dynamicMassEquivalent = weight * inertiaFactor;
      
      acceleration_ms2 = netForce / dynamicMassEquivalent;
    }

    // 8. Hız ve Mesafe Güncelleme
    speed_ms += acceleration_ms2 * dt;
    if (speed_ms < 0) speed_ms = 0;

    // Top Speed Limiter (Hız Kesici)
    const maxSpeedMs = config.topSpeedKmh ? config.topSpeedKmh / 3.6 : 1000;
    if (speed_ms > maxSpeedMs) {
      speed_ms = maxSpeedMs;
      acceleration_ms2 = 0; // Hızlanmayı durdur
    }
    
    distance_m += speed_ms * dt;
    time_s += dt;

    // Hedef Kontrolü
    const currentSpeedKmh = speed_ms * 3.6;
    if (mode === '200m' && distance_m >= 200) isFinished = true;
    if (mode === '400m' && distance_m >= 400) isFinished = true;
    if (mode === '800m' && distance_m >= 800) isFinished = true;
    if (mode === '0-100' && currentSpeedKmh >= 100) isFinished = true;
    if (mode === '100-200' && currentSpeedKmh >= 200) isFinished = true;
    if (mode === 'Top Speed') {
      if (acceleration_ms2 <= 0.05 && currentSpeedKmh > 50) {
        timeAtConstantSpeed += dt;
        if (timeAtConstantSpeed > 2.0) isFinished = true;
      } else {
        timeAtConstantSpeed = 0;
      }
    }

    // Split noktaları (sadece 400m için anlamlı ama dursun)
    if (split60ft === 0 && distance_m >= 18.288) split60ft = time_s;
    if (split330ft === 0 && distance_m >= 100.584) split330ft = time_s;

    // Zaman serisine kayıt (Her 20ms'de bir kaydet, daha akıcı animasyon için)
    if (Math.round(time_s * 1000) % 20 === 0 || isFinished) {
      timeSeries.push({
        time: parseFloat(time_s.toFixed(3)),
        distance: parseFloat(distance_m.toFixed(2)),
        speed_kmh: parseFloat(currentSpeedKmh.toFixed(1)),
        rpm: Math.round(engineRpm),
        gear: currentGearIndex + 1,
        slipPct: Math.round(isShifting ? 0 : slipPct)
      });
    }
  }

  return {
    elapsed_time_s: parseFloat(time_s.toFixed(3)),
    speed_at_end_kmh: parseFloat((speed_ms * 3.6).toFixed(1)),
    split_60ft_s: parseFloat(split60ft.toFixed(3)),
    split_330ft_s: parseFloat(split330ft.toFixed(3)),
    total_slip_time_s: parseFloat(slipTimeTotal.toFixed(3)),
    gear_shifts: gearShifts,
    slip_events: slipEvents,
    time_series: timeSeries,
    mode_target_met: isFinished
  };
}
