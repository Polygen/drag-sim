/**
 * Aerodinamik hesaplamaları — Genişletilmiş Model
 * - Hava direnci (drag)
 * - Aerodinamik basma kuvveti (downforce) — ön/arka ayrı
 * - Yuvarlanma direnci (hıza göre değişen)
 * - Hava yoğunluğu (sıcaklık, rakım, nem)
 * - Rüzgar etkisi
 */

export const GRAVITY = 9.81; // m/s²
export const AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m³ (15°C, deniz seviyesi)

/**
 * Aerodinamik sürükleme kuvveti (Drag Force)
 * F_drag = 0.5 × ρ × Cd × A × v²
 *
 * @param {number} airDensity - Hava yoğunluğu (kg/m³)
 * @param {number} dragCoefficient - Cx
 * @param {number} frontalArea - Ön yüzey alanı (m²)
 * @param {number} velocityMs - Araç hızı (m/s)
 * @param {number} windSpeedMs - Başa/arkaya rüzgar (+ = headwind, - = tailwind), default 0
 * @returns {number} Hava direnci (Newton)
 */
export function calculateAeroDrag(airDensity, dragCoefficient, frontalArea, velocityMs, windSpeedMs = 0) {
  const relativeVelocity = velocityMs + windSpeedMs; // Baş rüzgarda toplam hız artıyor
  return 0.5 * airDensity * dragCoefficient * frontalArea * (relativeVelocity * relativeVelocity);
}

/**
 * Aerodinamik basma kuvveti (Downforce)
 * F_down = 0.5 × ρ × Cl × A × v²
 * Cl negatifse lift (kötü), pozitifse downforce (iyi)
 *
 * @param {number} airDensity
 * @param {number} liftCoefficient - Cl (negatif = downforce üreten araçlar, biz pozitif basma olarak tanımlıyoruz)
 * @param {number} referenceAreaM2 - Genellikle frontal area
 * @param {number} velocityMs
 * @returns {{ totalDownforceN, frontDownforceN, rearDownforceN }}
 */
export function calculateDownforce(airDensity, liftCoefficient, referenceAreaM2, velocityMs) {
  const total = 0.5 * airDensity * Math.abs(liftCoefficient) * referenceAreaM2 * (velocityMs * velocityMs);

  // Downforce dağılımı: genellikle %40 ön, %60 arka (arka kanat daha büyük)
  // Bu değer araç konfigürasyonuna göre ayarlanabilir
  return {
    totalDownforceN: total,
    frontDownforceN: total * 0.38,
    rearDownforceN:  total * 0.62
  };
}

/**
 * Hıza göre değişen yuvarlanma direnci
 * Crr, düşük hızda sabit, yüksek hızda hafif artar (lastik deformasyon ısısı)
 *
 * @param {number} crr - Temel yuvarlanma direnci katsayısı
 * @param {number} weightKg - Araç ağırlığı (kg)
 * @param {number} velocityMs - Hız
 * @returns {number} Yuvarlanma direnci (Newton)
 */
export function calculateRollingResistance(crr, weightKg, velocityMs = 0) {
  // Hızla artan crr bileşeni (SAE J1269 modeli)
  const dynamicCrr = crr * (1 + velocityMs * 0.00025);
  return dynamicCrr * weightKg * GRAVITY;
}

/**
 * Eğimden kaynaklanan ek direnç / yardım
 * @param {number} weightKg
 * @param {number} inclineDeg - Eğim açısı (+ yokuş yukarı, - yokuş aşağı)
 * @returns {number} Ek kuvvet (Newton) — pozitif = direnç
 */
export function calculateInclineForce(weightKg, inclineDeg) {
  if (!inclineDeg) return 0;
  return weightKg * GRAVITY * Math.sin(inclineDeg * Math.PI / 180);
}

/**
 * Gerçekçi hava yoğunluğu hesabı (sıcaklık, rakım, nem)
 *
 * @param {number} temperatureC - Sıcaklık (°C)
 * @param {number} altitudeM    - Yükseklik (m)
 * @param {number} humidityPct  - Bağıl nem (0-100), default 50
 * @returns {number} Hava yoğunluğu (kg/m³)
 */
export function calculateAirDensity(temperatureC, altitudeM, humidityPct = 50) {
  const tempK = temperatureC + 273.15;

  // Barometrik basınç (ISA model)
  const pressurePa = 101325 * Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588);

  // Su buharı basıncı (Magnus formülü)
  const satPressure = 610.78 * Math.exp((17.2694 * temperatureC) / (temperatureC + 238.3));
  const vaporPressure = (humidityPct / 100) * satPressure;

  // Kuru hava basıncı
  const dryPressure = pressurePa - vaporPressure;

  // Nem hava yoğunluğunu düşürür (su buharı kuru havadan daha hafif: 18 vs 29 g/mol)
  const Rd = 287.058; // Kuru hava gaz sabiti
  const Rv = 461.495; // Su buharı gaz sabiti

  const density = (dryPressure / (Rd * tempK)) + (vaporPressure / (Rv * tempK));

  return Math.max(0.8, density);
}

/**
 * Aero etkinlik haritası — farklı parçalara göre Cl ve Cd katkısı
 * @param {object} aeroMods - { frontSplitter, rearWing, diffuser, widebody, undertray }
 * @param {number} baseCD
 * @param {number} baseCL
 * @returns {{ totalCd, totalCl }}
 */
export function calcAeroFromMods(aeroMods, baseCD, baseCL) {
  let deltaCd = 0;
  let deltaCl = 0;

  if (aeroMods?.frontSplitter) { deltaCd += 0.01; deltaCl += 0.08; }
  if (aeroMods?.rearWing)      { deltaCd += 0.03; deltaCl += 0.25; }
  if (aeroMods?.diffuser)      { deltaCd -= 0.01; deltaCl += 0.12; }
  if (aeroMods?.widebody)      { deltaCd += 0.02; } // Geniş gövde drag artırır
  if (aeroMods?.undertray)     { deltaCd -= 0.015; deltaCl += 0.06; }
  if (aeroMods?.stripDownBody) { deltaCd -= 0.02; } // İç döşeme söküldü

  return {
    totalCd: Math.max(0.20, baseCD + deltaCd),
    totalCl: Math.max(0, (baseCL || 0) + deltaCl)
  };
}
