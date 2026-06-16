/**
 * Motor Güç Modeli (Engine Power Model)
 * - Forged motor güç limiti
 * - Turbo lag ve boost modeli
 * - Yakıt tipi güç multiplier
 * - Flywheel ataleti
 * - Hava rakımı + sıcaklık güç kaybı (turbo compensation)
 * - Intercooler verimi
 */

/**
 * Yakıt tipine göre güç multiplier
 * @param {string} fuelType - '95' | '98' | 'E85' | 'Race' | 'E100'
 * @param {string} aspiration - 'NA' | 'turbo' | 'supercharged'
 * @returns {number} güç çarpanı
 */
export function fuelPowerMultiplier(fuelType, aspiration) {
  const isForced = aspiration === 'turbo' || aspiration === 'supercharged';

  switch (fuelType) {
    case '95':   return 1.000;
    case '98':   return isForced ? 1.025 : 1.010; // Turbo'da 98 daha belirgin fark yapar
    case 'E85':  return isForced ? 1.120 : 1.050; // E85 turbo'da çok avantajlı
    case 'E100': return isForced ? 1.150 : 1.070;
    case 'Race': return isForced ? 1.180 : 1.090; // Racing fuel (C16 gibi)
    default:     return 1.000;
  }
}

/**
 * Turbo lag modeli — anlık efektif boost basıncı
 * Boost, threshold RPM'den yukarıya doğru sigmoid ile yükseliyor
 *
 * @param {number} engineRpm
 * @param {number} maxBoostBar  - Maksimum boost (bar)
 * @param {number} lagRpm       - Turbo lag başlangıcı (boost 0 burada)
 * @param {number} fullBoostRpm - Tam boost devri
 * @returns {{ effectiveBoostBar, boostFraction }}
 */
export function calcTurboBoost(engineRpm, maxBoostBar, lagRpm, fullBoostRpm) {
  if (!maxBoostBar || maxBoostBar <= 0) {
    return { effectiveBoostBar: 0, boostFraction: 1.0 };
  }

  if (engineRpm <= lagRpm) {
    return { effectiveBoostBar: 0, boostFraction: 0 };
  }

  if (engineRpm >= fullBoostRpm) {
    return { effectiveBoostBar: maxBoostBar, boostFraction: 1.0 };
  }

  // Sigmoid boost artışı — gerçekçi turbo davranışı
  const progress = (engineRpm - lagRpm) / (fullBoostRpm - lagRpm); // 0 → 1
  const sigmoid  = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
  const boostFraction = Math.min(1.0, sigmoid);

  return {
    effectiveBoostBar: maxBoostBar * boostFraction,
    boostFraction
  };
}

/**
 * Boost'a bağlı güç artışı hesabı
 * Turbo, atmosferik basınca ek hava sıkıştırır.
 * Güç artışı ≈ (1 + boost_bar / P_atm) ile orantılı
 *
 * @param {number} engineTorqueNm     - Boost öncesi NA eğrisindeki tork
 * @param {number} boostBar           - Efektif boost basıncı
 * @param {number} atmosphericPressurePa - (genellikle 101325)
 * @param {number} intercoolerEfficiency - 0–1 (0.8 iyi intercooler)
 * @returns {number} boost uygulanmış tork (Nm)
 */
export function applyBoostToTorque(engineTorqueNm, boostBar, atmosphericPressurePa, intercoolerEfficiency = 0.75) {
  if (boostBar <= 0) return engineTorqueNm;

  const boostPa        = boostBar * 100000; // bar → Pa
  const pressureRatio  = (atmosphericPressurePa + boostPa) / atmosphericPressurePa;

  // Intercooler verimi: yüksek basınçta ısınan havayı soğutma
  // Soğutma olmadan yoğunluk kazancı daha az verimli
  const densityGain = 1 + (pressureRatio - 1) * intercoolerEfficiency;

  return engineTorqueNm * densityGain;
}

/**
 * Turbo araçlarda güç kaybı telafisi (rakım etkisi)
 * NA motorlar rakımda güç kaybeder, turbo motorlar boost artırarak telafi edebilir
 *
 * @param {number} powerLossFactor - Hava yoğunluğu oranı (1.0 = deniz seviyesi)
 * @param {number} maxBoostBar     - Motorun maksimum boost kapasitesi
 * @param {number} currentBoostBar - Şu anki boost
 * @returns {number} Efektif güç faktörü (NA vs turbo farkı)
 */
export function altitudePowerFactor(powerLossFactor, maxBoostBar, currentBoostBar) {
  if (maxBoostBar <= 0) {
    // NA motor — rakımda güç kaybeder
    return powerLossFactor;
  }

  // Turbo motor: compressor daha çok çalışarak rakımı telafi edebilir
  // Ama maksimum boost limitinde ise telafi yok
  const boostHeadroom = (maxBoostBar - currentBoostBar) / maxBoostBar;
  const turboCompensation = boostHeadroom * (1 - powerLossFactor); // Kalan boost kapasitesiyle telafi

  return Math.min(1.0, powerLossFactor + turboCompensation * 0.7);
}

/**
 * Forged motor güç limiti kontrolü
 * Forged internals olmadan yüksek güçte risk var.
 *
 * @param {number} requestedHp
 * @param {boolean} isForged
 * @param {number} stockHp
 * @param {number} maxHpPotential - Forged ile güvenli limit
 * @returns {{ safeHp, isOverLimit, riskLevel }}
 */
export function checkForgedLimit(requestedHp, isForged, stockHp, maxHpPotential) {
  // Stock güvenli limit: +%30 üzerine kadar (iyi motorlar için)
  const stockSafeLimit = stockHp * 1.30;
  const forgedSafeLimit = maxHpPotential || stockHp * 2.0;

  const effectiveLimit = isForged ? forgedSafeLimit : stockSafeLimit;
  const isOverLimit = requestedHp > effectiveLimit;

  let riskLevel;
  const ratio = requestedHp / effectiveLimit;
  if (ratio <= 1.0) riskLevel = 'safe';
  else if (ratio <= 1.15) riskLevel = 'warning';
  else if (ratio <= 1.40) riskLevel = 'danger';
  else riskLevel = 'critical';

  return {
    safeHp: effectiveLimit,
    isOverLimit,
    riskLevel,
    overLimitPct: Math.max(0, Math.round((ratio - 1) * 100))
  };
}

/**
 * Flywheel ataleti etkisi
 * Ağır volan (heavy flywheel) motor devir tepkisini yavaşlatır,
 * Hafif volan (light flywheel) → daha hızlı revving ama daha az depolanan kinetik enerji
 *
 * @param {string} flywheelType - 'heavy' | 'standard' | 'light' | 'ultralight'
 * @param {number} baseInertiaKgm2 - Motor bazı ataleti (kg·m²)
 * @returns {number} Modifiye edilmiş atalet (kg·m²)
 */
export function flywheelInertia(flywheelType, baseInertiaKgm2) {
  const base = baseInertiaKgm2 || 0.25;
  switch (flywheelType) {
    case 'ultralight': return base * 0.45;
    case 'light':      return base * 0.65;
    case 'standard':   return base * 1.00;
    case 'heavy':      return base * 1.40;
    default:           return base;
  }
}

/**
 * Stage modifikasyonlarına göre güç multiplier
 * @param {object} mods - { stage1: bool, stage2: bool, stage3: bool, intercoolerUpgrade: bool }
 * @param {string} aspiration
 * @returns {number}
 */
export function stageModMultiplier(mods, aspiration) {
  if (!mods) return 1.0;
  const isForced = aspiration === 'turbo' || aspiration === 'supercharged';
  let mult = 1.0;
  if (mods.stage1) mult *= isForced ? 1.08 : 1.05;  // ECU remap, exhaust
  if (mods.stage2) mult *= isForced ? 1.12 : 1.08;  // Intercooler, intake
  if (mods.stage3) mult *= isForced ? 1.18 : 1.10;  // Cams, internals
  if (mods.intercoolerUpgrade && isForced) mult *= 1.04;
  return mult;
}

/**
 * Gerçekçi motor güç hesabı (tüm faktörler birleştirilmiş)
 * @param {object} config
 * @returns {{ effectiveTorqueNm, boostBar, boostFraction, powerFactor }}
 */
export function calcEffectiveEnginePower(config) {
  const {
    baseTorqueNm,       // Tork eğrisinden gelen ham tork
    engineRpm,
    aspiration,
    maxBoostBar,
    turboLagRpm,
    fullBoostRpm,
    intercoolerType,
    fuelType,
    mods,
    powerLossFactor,    // Hava yoğunluğu oranı
    atmosphericPressurePa
  } = config;

  // 1. Yakıt multiplier
  const fuelMult = fuelPowerMultiplier(fuelType || '95', aspiration || 'NA');

  // 2. Stage mods
  const stageMult = stageModMultiplier(mods, aspiration);

  // 3. Turbo boost hesabı
  const { effectiveBoostBar, boostFraction } = calcTurboBoost(
    engineRpm,
    maxBoostBar || 0,
    turboLagRpm || 2000,
    fullBoostRpm || 3500
  );

  // 4. Intercooler verimliliği
  const intercoolerEff = intercoolerType === 'FMIC' ? 0.85
    : intercoolerType === 'TMIC' ? 0.70
    : intercoolerType === 'air-air' ? 0.80
    : 0.50; // Stock veya yok

  // 5. Boost tork uygulaması
  const boostedTorque = applyBoostToTorque(
    baseTorqueNm * fuelMult * stageMult,
    effectiveBoostBar,
    atmosphericPressurePa || 101325,
    intercoolerEff
  );

  // 6. Rakım faktörü (turbo telafisi ile)
  const altFactor = altitudePowerFactor(
    powerLossFactor || 1.0,
    maxBoostBar || 0,
    effectiveBoostBar
  );

  const effectiveTorqueNm = boostedTorque * altFactor;

  return {
    effectiveTorqueNm,
    boostBar: effectiveBoostBar,
    boostFraction,
    powerFactor: altFactor,
    fuelMult,
    stageMult
  };
}
