/**
 * Debriyaj Termal Modeli (Clutch Thermal Model)
 *
 * Gerçekçi debriyaj davranışı:
 * 1. Launch anında debriyaj yüksek RPM'de tutulurken kısmen bağlı (slip)
 * 2. Slip sırasında ısı üretilir
 * 3. Isınan debriyaj kapasitesi düşer (kavurma riski)
 * 4. Disk ısısı, çekiş miktarını doğrudan etkiler
 *
 * Formula:
 *   Clutch slip power = T_engine × ω_slip = T_engine × (ω_engine - ω_wheel)
 *   Heat rate = slip_power × friction_factor
 *   Clutch capacity degradation = f(temperature)
 */

/**
 * Debriyaj slip hesabı
 * @param {number} engineRpm     - Motor devri
 * @param {number} wheelRpm      - Tekerin sürücü tarafı devri (engineRpm / (gearRatio × finalDrive))
 * @param {number} engineTorqueNm
 * @param {number} clutchCapacityNm - Debriyajın aktarabileceği max tork
 * @returns {{ transmittedTorqueNm, slipRpm, slipFraction, heatPowerW }}
 */
export function calculateClutchSlip(engineRpm, wheelRpm, engineTorqueNm, clutchCapacityNm) {
  const slipRpm      = Math.max(0, engineRpm - wheelRpm);
  const slipFraction = engineRpm > 0 ? slipRpm / engineRpm : 0;

  // Debriyajın aktardığı tork, kapasitesiyle sınırlıdır
  // Slip varken: tork kapasiteye eşit (sürtünme limiti), slip yoksa: tam motor torku
  const transmittedTorqueNm = slipFraction > 0.02
    ? Math.min(engineTorqueNm, clutchCapacityNm * (1 - slipFraction * 0.3))
    : engineTorqueNm;

  // Isı üretimi: slip_angular_velocity × torque
  const omegaSlip  = (slipRpm * 2 * Math.PI) / 60;
  const heatPowerW = transmittedTorqueNm * omegaSlip * 0.85; // %85 ısıya dönüşüyor

  return {
    transmittedTorqueNm: Math.max(0, transmittedTorqueNm),
    slipRpm,
    slipFraction,
    heatPowerW
  };
}

/**
 * Debriyaj sıcaklık güncellemesi
 * @param {number} currentTempC   - Mevcut disk sıcaklığı
 * @param {number} heatPowerW     - Anlık ısı gücü (W)
 * @param {number} ambientTempC   - Ortam sıcaklığı
 * @param {number} dt             - Zaman adımı (s)
 * @returns {number} Yeni sıcaklık
 */
export function updateClutchThermal(currentTempC, heatPowerW, ambientTempC, dt) {
  // Debriyaj disk termal kütlesi ~ 1.8kg çelik disk, ısı kapasitesi 500 J/(kg·K)
  const thermalMassJ = 900; // J/°C

  // Soğuma: doğal konveksiyon (araç hareketsizken bile biraz soğur)
  const coolingCoeff = 0.008; // W/°C
  const coolingPower = (currentTempC - ambientTempC) * coolingCoeff * 1000;

  const deltaT = (heatPowerW - coolingPower) / thermalMassJ * dt;

  // Debriyaj diski maksimum 800°C'de tamamen yanmış sayılır
  return Math.max(ambientTempC, Math.min(850, currentTempC + deltaT));
}

/**
 * Sıcaklık bağımlı debriyaj kapasitesi
 * @param {number} baseCapacityNm - Soğuk debriyaj kapasitesi
 * @param {number} tempC          - Disk sıcaklığı
 * @returns {number} Efektif kapasite (Nm)
 */
export function clutchCapacityAtTemp(baseCapacityNm, tempC) {
  // 200°C'ye kadar tam kapasite
  // 200-500°C arası doğrusal düşüş (%40'a kadar)
  // 500°C üzerinde kritik düşüş
  if (tempC < 200) return baseCapacityNm;
  if (tempC < 500) {
    const factor = 1 - ((tempC - 200) / 300) * 0.60;
    return baseCapacityNm * factor;
  }
  // 500°C+ debriyaj çok hasar görmüş
  const factor = 0.40 * Math.max(0, 1 - (tempC - 500) / 350);
  return baseCapacityNm * factor;
}

/**
 * Optimum launch RPM hesabı
 * Maksimum ön yük kapasitesine (traksiyon limitine) göre en iyi kalkış devri
 *
 * @param {number[]} torqueCurve  - [{rpm, nm}]
 * @param {number} maxTractionForceN
 * @param {number} gearRatio1     - 1. vites oranı
 * @param {number} finalDrive
 * @param {number} tireRadiusM
 * @param {number} efficiency
 * @returns {{ optRpm: number, optTorqueNm: number, optWheelForceN: number }}
 */
export function calcOptimalLaunchRpm(torqueCurve, maxTractionForceN, gearRatio1, finalDrive, tireRadiusM, efficiency = 0.92) {
  if (!torqueCurve || torqueCurve.length === 0) {
    return { optRpm: 3000, optTorqueNm: 0, optWheelForceN: 0 };
  }

  let bestRpm = torqueCurve[0].rpm;
  let bestDelta = Infinity;

  for (const point of torqueCurve) {
    const wheelForce = (point.nm * gearRatio1 * finalDrive * efficiency) / tireRadiusM;
    // İdeal: tekerlek kuvveti traksiyon limitine mümkün olduğunca yakın ama altında
    const delta = Math.abs(wheelForce - maxTractionForceN);
    if (wheelForce <= maxTractionForceN * 1.05 && delta < bestDelta) {
      bestDelta = delta;
      bestRpm = point.rpm;
    }
  }

  const bestPoint = torqueCurve.find(p => p.rpm === bestRpm) || torqueCurve[0];
  const optWheelForceN = (bestPoint.nm * gearRatio1 * finalDrive * efficiency) / tireRadiusM;

  return {
    optRpm: bestRpm,
    optTorqueNm: bestPoint.nm,
    optWheelForceN
  };
}
