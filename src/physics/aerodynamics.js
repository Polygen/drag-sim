/**
 * Aerodinamik direnç hesaplamaları
 */

export const GRAVITY = 9.81; // m/s^2
export const AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m^3 (15°C, deniz seviyesi)

/**
 * @param {number} airDensity - Hava yoğunluğu (kg/m^3)
 * @param {number} dragCoefficient - Cx (Aero drag katsayısı)
 * @param {number} frontalArea - Ön yüzey alanı (m^2)
 * @param {number} velocityMs - Anlık hız (m/s)
 * @returns {number} Hava direnci (Newton)
 */
export function calculateAeroDrag(airDensity, dragCoefficient, frontalArea, velocityMs) {
  return 0.5 * airDensity * dragCoefficient * frontalArea * (velocityMs * velocityMs);
}

/**
 * Yuvarlanma direnci (Rolling resistance)
 * @param {number} crr - Yuvarlanma direnci katsayısı (slick ~0.008, street ~0.012)
 * @param {number} weightKg - Araç ağırlığı (kg)
 * @returns {number} Yuvarlanma direnci (Newton)
 */
export function calculateRollingResistance(crr, weightKg) {
  return crr * weightKg * GRAVITY;
}

/**
 * Hava yoğunluğu hesaplayıcı (sıcaklık ve yüksekliğe göre)
 * @param {number} temperatureC - Sıcaklık (°C)
 * @param {number} altitudeM - Yükseklik (metre)
 * @returns {number} Hava yoğunluğu (kg/m^3)
 */
export function calculateAirDensity(temperatureC, altitudeM) {
  // Basit hava yoğunluğu modeli
  // Standart basınç 101325 Pa
  const standardPressure = 101325 * Math.pow(1 - 0.0000225577 * altitudeM, 5.25588);
  const tempK = temperatureC + 273.15;
  const gasConstant = 287.05; // J/(kg*K)
  return standardPressure / (gasConstant * tempK);
}
