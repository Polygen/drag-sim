/**
 * Motor Tork ve Güç Eğrisi Interpolasyonu
 */

/**
 * Devir noktaları dizisinden anlık devire göre tork değerini hesaplar
 * @param {Array<{rpm: number, nm: number}>} torquePoints - Tork eğrisi noktaları (en az 8)
 * @param {number} currentRpm - Anlık motor devri
 * @returns {number} Anlık tork (Nm)
 */
export function getTorqueAtRpm(torquePoints, currentRpm) {
  if (!torquePoints || torquePoints.length === 0) return 0;
  
  // Eğrinin dışındaysa sınır değerlerini kullan
  if (currentRpm <= torquePoints[0].rpm) return torquePoints[0].nm;
  if (currentRpm >= torquePoints[torquePoints.length - 1].rpm) {
    // Redline'ı geçtiğinde güç hızla düşer (basit bir düşüş modeli)
    const lastPoint = torquePoints[torquePoints.length - 1];
    const diff = currentRpm - lastPoint.rpm;
    return Math.max(0, lastPoint.nm - (diff * 0.1));
  }

  // Lineer interpolasyon
  for (let i = 0; i < torquePoints.length - 1; i++) {
    const p1 = torquePoints[i];
    const p2 = torquePoints[i + 1];
    
    if (currentRpm >= p1.rpm && currentRpm <= p2.rpm) {
      const ratio = (currentRpm - p1.rpm) / (p2.rpm - p1.rpm);
      return p1.nm + (ratio * (p2.nm - p1.nm));
    }
  }
  
  return 0;
}

/**
 * Beygir gücünden tork hesaplama veya tam tersi (referans için)
 * @param {number} hp 
 * @param {number} rpm 
 * @returns {number} tork (Nm)
 */
export function hpToNm(hp, rpm) {
  if (rpm === 0) return 0;
  // HP = (Torque_Nm * RPM) / 7120 (yaklaşık faktör 7120.9)
  return (hp * 7120.9) / rpm;
}

export function nmToHp(nm, rpm) {
  return (nm * rpm) / 7120.9;
}
