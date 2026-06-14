import { GRAVITY } from './aerodynamics.js';

/**
 * Aks yük transferi hesaplaması
 * @param {number} weightKg - Araç toplam ağırlığı
 * @param {number} accelerationMs2 - Mevcut ivme
 * @param {number} cogHeightM - Ağırlık merkezi yüksekliği (m)
 * @param {number} wheelbaseM - Dingil mesafesi (m)
 * @returns {number} Transfer edilen yük (Newton cinsinden)
 */
export function calculateWeightTransfer(weightKg, accelerationMs2, cogHeightM, wheelbaseM) {
  // Transfer edilen yük (N)
  return (weightKg * accelerationMs2 * cogHeightM) / wheelbaseM;
}

/**
 * Çekiş tekerleklerindeki dikey yükü hesaplar (Normal Force)
 * @param {number} weightKg - Araç ağırlığı
 * @param {number} weightDistFrontPct - Ön aks ağırlık dağılımı yüzdesi (0-100)
 * @param {string} drivetrain - 'RWD', 'FWD', 'AWD'
 * @param {number} weightTransferN - İvmelenmeden kaynaklı yük transferi (N)
 * @param {number} aeroDownforceN - Aerodinamik basma kuvveti (N) (basitlik için 0 varsayılabilir)
 * @returns {number} Çeken tekerleklerdeki dikey yük (N)
 */
export function calculateDrivenNormalForce(weightKg, weightDistFrontPct, drivetrain, weightTransferN, aeroDownforceN = 0) {
  const staticFrontLoadN = weightKg * GRAVITY * (weightDistFrontPct / 100);
  const staticRearLoadN = weightKg * GRAVITY * ((100 - weightDistFrontPct) / 100);
  
  let drivenLoadN = 0;
  
  if (drivetrain === 'RWD') {
    // RWD'de yük arkaya aktarılır
    drivenLoadN = staticRearLoadN + weightTransferN + (aeroDownforceN / 2);
  } else if (drivetrain === 'FWD') {
    // FWD'de yük önden kalkar (çekiş düşer)
    drivenLoadN = staticFrontLoadN - weightTransferN + (aeroDownforceN / 2);
  } else if (drivetrain === 'AWD') {
    // AWD tüm tekerlekleri kullanır
    drivenLoadN = (weightKg * GRAVITY) + aeroDownforceN;
  }
  
  // Tekerleğin yerden kesilmesini önle (negatif olamaz)
  return Math.max(0, drivenLoadN);
}

/**
 * Aktarılabilir maksimum kuvveti hesaplar
 * @param {number} normalForceN - Çeken tekerleklerdeki dikey yük
 * @param {number} mu - Sürtünme katsayısı (lastik/yüzey eşleşmesi)
 * @param {number} tractionFactor - Diferansiyel çekiş faktörü (Open: 0.65, LSD: 0.91, vs)
 * @returns {number} Aktarılabilecek maksimum kuvvet (N)
 */
export function calculateMaxTractionForce(normalForceN, mu, tractionFactor) {
  return normalForceN * mu * tractionFactor;
}
