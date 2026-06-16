/**
 * Çekiş ve Yük Transferi Modeli — Genişletilmiş
 * - Aks yük transferi (statik + dinamik)
 * - Aerodinamik downforce entegrasyonu
 * - Diferansiyel tipi bazlı çekiş hesabı
 * - Dört çeker tork dağılımı
 */

import { GRAVITY } from './aerodynamics.js';

/**
 * Aks yük transferi hesabı
 * Δ_weight = (M × a × h_cog) / L_wheelbase
 *
 * @param {number} weightKg       - Toplam ağırlık (kg)
 * @param {number} accelerationMs2 - Anlık ivme
 * @param {number} cogHeightM     - Ağırlık merkezi yüksekliği (m)
 * @param {number} wheelbaseM     - Dingil mesafesi (m)
 * @returns {number} Transfer edilen yük (Newton) — pozitif = arkaya
 */
export function calculateWeightTransfer(weightKg, accelerationMs2, cogHeightM, wheelbaseM) {
  return (weightKg * GRAVITY * Math.max(0, accelerationMs2) * cogHeightM) / (wheelbaseM * GRAVITY);
}

/**
 * Sürücü kütlesinin CG'ye etkisi
 * @param {number} carWeightKg
 * @param {number} carCogHeightM
 * @param {number} driverWeightKg
 * @param {number} seatHeightM     - Sürücü oturma yüksekliği (m)
 * @param {number} carWeightFrontPct - Araç ağırlık dağılımı (%)
 * @param {number} seatPositionPct - Sürücünün dingil mesafesine konumu (0 = tam ön, 100 = tam arka)
 * @returns {{ totalWeightKg, effectiveCogHeightM, effectiveWeightFrontPct }}
 */
export function calcDriverEffect(carWeightKg, carCogHeightM, driverWeightKg, seatHeightM = 0.35,
                                   carWeightFrontPct = 50, seatPositionPct = 45) {
  const totalWeightKg = carWeightKg + driverWeightKg;

  // Ağırlıklı ortalama CG yüksekliği
  const effectiveCogHeightM = (carWeightKg * carCogHeightM + driverWeightKg * seatHeightM) / totalWeightKg;

  // Sürücünün ön/arka yük dağılımına etkisi
  const driverFrontContribution = (100 - seatPositionPct) / 100; // Sürücü öne yakınsa ön ağır
  const driverFrontWeightKg = driverWeightKg * driverFrontContribution;
  const totalFrontWeightKg = (carWeightKg * carWeightFrontPct / 100) + driverFrontWeightKg;
  const effectiveWeightFrontPct = (totalFrontWeightKg / totalWeightKg) * 100;

  return { totalWeightKg, effectiveCogHeightM, effectiveWeightFrontPct };
}

/**
 * Çekiş tekerleklerindeki dikey yük hesabı
 * Normal force'a aerodinamik downforce eklendi.
 *
 * @param {number} weightKg
 * @param {number} weightDistFrontPct  - Ön ağırlık yüzdesi
 * @param {string} drivetrain          - 'RWD' | 'FWD' | 'AWD'
 * @param {number} weightTransferN     - İvmeden kaynaklı yük transferi (N)
 * @param {number} frontDownforceN     - Aerodinamik ön basma (N)
 * @param {number} rearDownforceN      - Aerodinamik arka basma (N)
 * @returns {number} Çeken tekerleklerdeki dikey yük (N)
 */
export function calculateDrivenNormalForce(
  weightKg, weightDistFrontPct, drivetrain, weightTransferN,
  frontDownforceN = 0, rearDownforceN = 0
) {
  const totalWeightN    = weightKg * GRAVITY;
  const staticFrontN    = totalWeightN * (weightDistFrontPct / 100);
  const staticRearN     = totalWeightN * (1 - weightDistFrontPct / 100);

  let drivenLoadN = 0;

  if (drivetrain === 'RWD') {
    // Arkaya ağırlık transferi → daha fazla çekiş
    drivenLoadN = Math.min(totalWeightN, staticRearN + weightTransferN) + rearDownforceN;
  } else if (drivetrain === 'FWD') {
    // Önden ağırlık kalkar → çekiş kayıpları
    drivenLoadN = Math.max(0, staticFrontN - weightTransferN) + frontDownforceN;
  } else if (drivetrain === 'AWD') {
    // AWD tüm tekerlekleri kullanır, aero da tamamen faydalı
    drivenLoadN = totalWeightN + frontDownforceN + rearDownforceN;
  }

  return Math.max(0, drivenLoadN);
}

/**
 * Diferansiyel tipine göre çekiş faktörü
 * @param {string} diffType - 'open' | 'lsd' | 'spool' | 'torsen' | 'helical' | 'clutch_pack'
 * @param {string} drivetrain
 * @returns {number} Traksiyon faktörü (0–1.3)
 */
export function differentialFactor(diffType, drivetrain) {
  if (drivetrain === 'AWD') return 1.0; // AWD'de diff tipi daha az etkili (tork split sistemi var)

  switch (diffType) {
    case 'open':        return 0.65;  // Açık diff — tek tekerlek kayar
    case 'lsd':         return 0.88;  // LSD (generic)
    case 'helical':     return 0.90;  // Helical/Torsen LSD
    case 'clutch_pack': return 0.92;  // Clutch pack LSD (ayarlanabilir)
    case 'torsen':      return 0.91;  // Torsen B/C
    case 'spool':       return 1.00;  // Spool/weld — tam kilitleme, en fazla çekiş
    case 'plated_lsd':  return 0.95;  // Plated LSD (Competition)
    default:            return 0.80;  // Bilinmeyen
  }
}

/**
 * Maksimum aktarılabilir çekiş kuvveti
 * @param {number} normalForceN
 * @param {number} mu                - Sürtünme katsayısı (surface × compound)
 * @param {number} diffTractionFactor - Diferansiyel çekiş faktörü
 * @returns {number} Max çekiş kuvveti (N)
 */
export function calculateMaxTractionForce(normalForceN, mu, diffTractionFactor) {
  return normalForceN * mu * diffTractionFactor;
}

/**
 * G kuvveti hesabı
 * @param {number} accelerationMs2
 * @returns {number} g değeri
 */
export function calcGForce(accelerationMs2) {
  return accelerationMs2 / GRAVITY;
}
