/**
 * Lastik Fizik Modeli (Tire Physics Model)
 * - ISO lastik boyutu → gerçek yarıçap
 * - Sıcaklık bağımlı tutunma katsayısı mu(T)
 * - Lastik ısı dinamiği (slip gücü → ısınma)
 * - Soğuk lastik cezası
 */

/**
 * ISO lastik boyutundan gerçek yarıçap hesabı
 * Format: "255/40R18" → { radiusM, circumferenceM, widthMm, weight_kg }
 * @param {string} sizeString - "255/40R18" formatında
 * @returns {{ radiusM: number, circumferenceM: number, widthMm: number, sidewallMm: number }}
 */
export function parseTireSize(sizeString) {
  if (!sizeString) return defaultTireGeometry();

  // "255/40R18" veya "255/40/18" veya "225/45R17" formatlarını destekle
  const match = sizeString.match(/(\d+)\s*[/\\]\s*(\d+)\s*R?\s*(\d+)/i);
  if (!match) return defaultTireGeometry();

  const widthMm   = parseInt(match[1]);   // 255
  const aspectRatio = parseInt(match[2]); // 40
  const rimInch   = parseInt(match[3]);   // 18

  const sidewallMm     = (widthMm * aspectRatio) / 100;         // 102mm
  const rimDiameterMm  = rimInch * 25.4;                        // 457.2mm
  const outerDiameterMm = rimDiameterMm + 2 * sidewallMm;       // 661.2mm
  const radiusM         = outerDiameterMm / 2000;               // 0.3306m
  const circumferenceM  = Math.PI * outerDiameterMm / 1000;     // 2.077m

  // Yaklaşık lastik ağırlığı (genişlik ve çapa göre lineer)
  const weightKg = 6 + (widthMm - 175) * 0.03 + (rimInch - 15) * 0.5;

  return { radiusM, circumferenceM, widthMm, sidewallMm, rimInch, outerDiameterMm, weightKg };
}

function defaultTireGeometry() {
  return {
    radiusM: 0.32,
    circumferenceM: 2.011,
    widthMm: 225,
    sidewallMm: 45,
    rimInch: 17,
    outerDiameterMm: 640,
    weightKg: 9
  };
}

/**
 * Motor RPM'inden teker hızını hesaplar
 * @param {number} engineRpm
 * @param {number} gearRatio - Mevcut vites oranı
 * @param {number} finalDrive
 * @param {number} tireCircumferenceM
 * @returns {{ wheelRpm: number, speedKmh: number }}
 */
export function wheelSpeedFromRpm(engineRpm, gearRatio, finalDrive, tireCircumferenceM) {
  const wheelRpm  = engineRpm / (gearRatio * finalDrive);
  const speedKmh  = (wheelRpm * tireCircumferenceM * 60) / 1000;
  return { wheelRpm, speedKmh };
}

/**
 * Teker hızından motor RPM hesabı
 * @param {number} speedMs - Araç hızı (m/s)
 * @param {number} gearRatio
 * @param {number} finalDrive
 * @param {number} tireRadiusM
 * @returns {number} engine RPM
 */
export function rpmFromWheelSpeed(speedMs, gearRatio, finalDrive, tireRadiusM) {
  const wheelRpm = (speedMs * 60) / (2 * Math.PI * tireRadiusM);
  return wheelRpm * gearRatio * finalDrive;
}

/**
 * Sıcaklık bağımlı tutunma katsayısı mu(T)
 * Gaussian zirve modeli: optimal sıcaklıkta maksimum, dışarıda düşüyor.
 *
 * @param {number} tireCompound - { optimal_temp_c_min, optimal_temp_c_max, cold_penalty_pct, mu_peak }
 * @param {number} tireTemp - Anlık lastik sıcaklığı (°C)
 * @param {number} baseMu - Referans mu değeri (surface × compound)
 * @returns {number} Efektif mu
 */
export function calcThermalMu(tireCompound, tireTemp, baseMu) {
  if (!tireCompound) return baseMu;

  const Tmin = tireCompound.optimal_temp_c_min || 60;
  const Tmax = tireCompound.optimal_temp_c_max || 100;
  const Topt = (Tmin + Tmax) / 2;
  const Trange = (Tmax - Tmin) / 2 + 15; // Gaussian genişliği

  // Gaussian modeli: T = Topt'ta mu tam, uzaklaştıkça düşüyor
  const gaussFactor = Math.exp(-Math.pow(tireTemp - Topt, 2) / (2 * Trange * Trange));

  // Soğuk lastik cezası (min sıcaklığın altında)
  const coldPenaltyPct = tireCompound.cold_penalty_pct || 0;
  const coldFactor = tireTemp < Tmin
    ? 1 - (coldPenaltyPct / 100) * Math.min(1, (Tmin - tireTemp) / 40)
    : 1.0;

  // Aşırı ısınma cezası (maksimum üzerinde)
  const overHeatFactor = tireTemp > Tmax + 30 ? Math.max(0.6, 1 - (tireTemp - Tmax - 30) / 100) : 1.0;

  // En az 0.5× baz mu, en fazla 1.1× (Gaussian zirve biraz artırabilir)
  const thermalMultiplier = Math.min(1.10, Math.max(0.50, gaussFactor * coldFactor * overHeatFactor));

  return baseMu * thermalMultiplier;
}

/**
 * Lastik sıcaklık güncellemesi (tek adım, dt saniye)
 *
 * Isınma: slip_power × thermCoeff / thermalMass
 * Soğuma: (T - ambientT) × coolingCoeff
 *
 * @param {number} currentTempC - Mevcut lastik sıcaklığı
 * @param {number} slipForceN - Patinaj kuvveti (N)
 * @param {number} slipSpeedMs - Göreceli kayma hızı (m/s) = vehicleSpeed × slipPct/100
 * @param {number} ambientTempC - Ortam sıcaklığı
 * @param {object} compound - Lastik bileşiği parametreleri
 * @param {number} dt - Zaman adımı (s)
 * @returns {number} Yeni sıcaklık (°C)
 */
export function updateTireThermal(currentTempC, slipForceN, slipSpeedMs, ambientTempC, compound, dt) {
  // Slip gücü (Watt)
  const slipPowerW = Math.abs(slipForceN * slipSpeedMs);

  // Termal kütle (J/°C) — lastik kauçuk ısı kapasitesi ≈ 1800 J/(kg·K), ağırlık 9kg
  const thermalMass = (compound?.thermal_mass) || 14000; // J/°C

  // Isınma hızı — slip gücünün bir kısmı ısıya dönüşür (%60 oranında gerçekçi)
  const heatTransfer = slipPowerW * 0.60;

  // Soğuma sabiti — konveksiyon (m/s bazlı) + kondüksiyon
  // Araç hızlanırken lastik soğur (hava akışı artar)
  const coolingCoeff = 0.015 + slipSpeedMs * 0.002; // W/(°C)
  const cooling = (currentTempC - ambientTempC) * coolingCoeff * 1000;

  const deltaT = (heatTransfer - cooling) / thermalMass * dt;

  // Maksimum 280°C (lastik erir), minimum ambient
  return Math.max(ambientTempC, Math.min(280, currentTempC + deltaT));
}

/**
 * Başlangıç lastik sıcaklığı hesabı
 * @param {number} ambientTempC
 * @param {boolean} hasBurnout - Burnout yapıldı mı?
 * @param {object} compound - Lastik bileşiği
 * @returns {number}
 */
export function initialTireTemp(ambientTempC, hasBurnout, compound) {
  const Topt = ((compound?.optimal_temp_c_min || 60) + (compound?.optimal_temp_c_max || 100)) / 2;
  if (hasBurnout) {
    // Burnout ile lastik optimal sıcaklığa getirilmiş
    return Topt * 0.9 + ambientTempC * 0.1;
  }
  // Soğuk lastik: ambient + biraz sürüşten kalan ısı
  return ambientTempC + 5;
}
