/**
 * Kafa Kaldırma (Wheelie) Fizik Modeli
 *
 * Bir drag yarışında RWD araçlar kalkışta kafa kaldırabilir.
 * Fizik: Arka teker çekiş kuvvetinin yarattığı döndürme momenti,
 *        ön aks ağırlığından kaynaklı dengeleme momentini aşarsa wheelie başlar.
 *
 * Temel formül:
 *   Wheelie Moment (döndürücü) = F_traction × h_cog
 *   Restoring Moment (dengeleyici) = W_front × L_wheelbase
 *   
 *   Wheelie oluşur: F_traction × h_cog > W_front × L_wheelbase
 *
 * Ekstra: Wheelie açısı arttıkça ön teker yükü sıfıra iner (tam wheelie)
 */

import { GRAVITY } from './aerodynamics.js';

/**
 * Kafa kaldırma analizi — anlık koşullara göre
 *
 * @param {object} params
 * @param {number} params.tractionForceN     - Arka tekerlerdeki net çekiş kuvveti (N)
 * @param {number} params.totalWeightKg      - Araç + sürücü toplam ağırlığı (kg)
 * @param {number} params.weightFrontPct     - Ön aks ağırlık yüzdesi (0-100)
 * @param {number} params.cogHeightM         - Ağırlık merkezi yüksekliği (m)
 * @param {number} params.wheelbaseM         - Dingil mesafesi (m)
 * @param {number} params.currentWheelieAngle - Önceki adımın wheelie açısı (°)
 * @param {number} params.drivetrain         - 'RWD' | 'AWD' | 'FWD'
 * @param {number} dt                        - Zaman adımı (s)
 * @returns {{ isWheelie: boolean, wheelieAngleDeg: number, frontLoadN: number, tractionReductionPct: number }}
 */
export function calculateWheelie(params, dt) {
  const {
    tractionForceN,
    totalWeightKg,
    weightFrontPct,
    cogHeightM,
    wheelbaseM,
    currentWheelieAngle = 0,
    drivetrain,
    speedMs = 0
  } = params;

  // FWD'de wheelie olmaz, AWD'de çok zor
  if (drivetrain === 'FWD') {
    return { isWheelie: false, wheelieAngleDeg: 0, frontLoadN: totalWeightKg * GRAVITY * (weightFrontPct / 100), tractionReductionPct: 0 };
  }

  const totalWeightN   = totalWeightKg * GRAVITY;
  const frontStaticN   = totalWeightN * (weightFrontPct / 100);
  const rearStaticN    = totalWeightN * (1 - weightFrontPct / 100);

  // Döndürücü moment (wheelie yapan kuvvet) = F_traction × h_cog
  const wheelieMoment  = tractionForceN * cogHeightM;

  // Dengeleyici moment = ön aks yükü × dingil mesafesi
  // Ön aks yükü mevcut wheelie açısına göre azalır
  const angleRad       = (currentWheelieAngle * Math.PI) / 180;
  const frontLoadN     = Math.max(0, frontStaticN * Math.cos(angleRad) - rearStaticN * Math.sin(angleRad));
  const restoringMoment = frontLoadN * wheelbaseM;

  // Net wheelie moment
  const netWheelieM    = wheelieMoment - restoringMoment;

  // AWD'de wheelie eşiği yüksek
  const awdFactor = drivetrain === 'AWD' ? 1.8 : 1.0;

  let newAngleDeg = currentWheelieAngle;

  if (netWheelieM > 0 && speedMs < 80) {
    // Wheelie açısı artıyor
    // Açısal ivme ≈ net_moment / (0.5 × m × L²) basitleştirilmiş rijit cisim
    const momentOfInertia = 0.5 * totalWeightKg * wheelbaseM * wheelbaseM;
    const angularAccelRad = (netWheelieM / awdFactor) / momentOfInertia;
    const angularAccelDeg = angularAccelRad * (180 / Math.PI);
    newAngleDeg = Math.min(85, currentWheelieAngle + angularAccelDeg * dt * 15); // Ölçek faktörü gerçekçilik için
  } else if (currentWheelieAngle > 0) {
    // Wheelie bitti, araç düşüyor — yerçekimi etkisiyle hızla kapanır
    newAngleDeg = Math.max(0, currentWheelieAngle - 30 * dt);
  }

  const isWheelie = newAngleDeg > 2;

  // Traksiyon azalma yüzdesi: Ön tekerler havaya kalkınca AWD'de kayıp, diğerlerinde etki az
  // Ama kafa havadayken aero drag azalır (frontal area küçülür ~%5 per 10°)
  const tractionReductionPct = drivetrain === 'AWD' ? newAngleDeg * 0.3 : 0;

  return {
    isWheelie,
    wheelieAngleDeg: parseFloat(newAngleDeg.toFixed(2)),
    frontLoadN,
    tractionReductionPct,
    aeroDragReductionPct: newAngleDeg * 0.5 // Kafa havada drag azalır
  };
}

/**
 * Wheelie'nin aerodinamik etkisi
 * Araç kafa kaldırınca frontal alan küçülür → daha az hava direnci
 * @param {number} baseFrontalAreaM2
 * @param {number} wheelieAngleDeg
 * @returns {number} Efektif frontal alan
 */
export function effectiveFrontalArea(baseFrontalAreaM2, wheelieAngleDeg) {
  // Her 10 derece açı için ~%3 frontal alan azalması
  const reductionFactor = 1 - (wheelieAngleDeg * 0.003);
  return baseFrontalAreaM2 * Math.max(0.70, reductionFactor);
}

/**
 * Wheelie risk analizi (uyarı sistemi için)
 * @param {object} engineConfig
 * @param {object} vehicleConfig
 * @returns {{ riskLevel: 'none'|'low'|'medium'|'high', wheelieThresholdHp: number }}
 */
export function analyzeWheelieRisk(engineConfig, vehicleConfig) {
  if (!vehicleConfig || !engineConfig) return { riskLevel: 'none', wheelieThresholdHp: 9999 };

  const { curb_weight_kg, wheelbase_mm, weight_distribution_front_pct, drivetrain_stock } = vehicleConfig;
  if (drivetrain_stock === 'FWD') return { riskLevel: 'none', wheelieThresholdHp: 9999 };

  const weightKg = curb_weight_kg + 80; // Sürücü
  const wheelbaseM = (wheelbase_mm || 2700) / 1000;
  const frontPct = (weight_distribution_front_pct || 50) / 100;
  const cogH = 0.50; // Varsayılan
  const gearRatio1 = 3.5; // Yaklaşık 1. vites
  const finalDrive = 3.5;
  const tireRadius = 0.32;

  // Wheelie eşiği: F_traction = (W_front × L) / h
  const frontWeightN = weightKg * 9.81 * frontPct;
  const maxTractionForWheelieN = (frontWeightN * wheelbaseM) / cogH;

  // Bu traksiyon kuvvetini üretecek minimum tekerlek torku
  const minWheelTorqueNm = maxTractionForWheelieN * tireRadius;
  // Engine torque = wheelTorque / (gearRatio × finalDrive × efficiency)
  const minEngineTorqueNm = minWheelTorqueNm / (gearRatio1 * finalDrive * 0.92);
  // HP = torque × RPM / 7120 (launch RPM yaklaşık 3000)
  const wheelieThresholdHp = Math.round((minEngineTorqueNm * 3000) / 7120);

  const engineHp = parseInt(engineConfig.stock_hp_at_rpm) || 300;
  const ratio = engineHp / wheelieThresholdHp;

  let riskLevel;
  if (drivetrain_stock === 'AWD') {
    riskLevel = ratio > 2.5 ? 'low' : 'none';
  } else {
    if (ratio < 0.8) riskLevel = 'none';
    else if (ratio < 1.1) riskLevel = 'low';
    else if (ratio < 1.5) riskLevel = 'medium';
    else riskLevel = 'high';
  }

  return { riskLevel, wheelieThresholdHp };
}
