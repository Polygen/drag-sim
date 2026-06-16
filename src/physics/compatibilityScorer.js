/**
 * Uyumluluk Skorlayıcı (Compatibility Scorer)
 * Belirli bir motor ve şanzıman için en uygun aracı tavsiye eder.
 */

function extractNum(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

export function getTopCompatibleVehicles(engine, transmission, allVehicles) {
  if (!engine || !allVehicles || allVehicles.length === 0) return [];

  const engineHp = extractNum(engine.stock_hp_at_rpm);
  const engineWidth = extractNum(engine.engine_width_mm);
  const engineLength = extractNum(engine.engine_length_mm);

  const scoredVehicles = allVehicles.map(vehicle => {
    // 1. Güç/Ağırlık Oranı (Ana Performans Faktörü)
    const pwrToWeight = engineHp / vehicle.curb_weight_kg;

    // 2. Çekiş Uyum Faktörü (RWD/AWD drag için avantajlı, FWD dezavantajlı)
    let tractionFactor = 1.0;
    if (vehicle.drivetrain_stock === 'AWD') tractionFactor = 1.1;
    if (vehicle.drivetrain_stock === 'RWD') tractionFactor = 1.0;
    if (vehicle.drivetrain_stock === 'FWD') tractionFactor = 0.8;

    // 3. Şasi Skoru
    const chassisScore = vehicle.chassis_rigidity_score || 5;

    // 4. Boyut Uyumsuzluğu Cezası
    let sizePenalty = 1.0;
    const bayWidth = extractNum(vehicle.engine_bay_max_width_mm);
    const bayLength = extractNum(vehicle.engine_bay_max_length_mm);

    if (engineWidth > bayWidth) sizePenalty *= 1.2;
    if (engineLength > bayLength) sizePenalty *= 1.15;
    
    // Yön uyumsuzluğu cezası
    const expectedOrientation = vehicle.drivetrain_stock === 'FWD' ? 'transverse' : 'longitudinal';
    if (engine.orientation && engine.orientation !== expectedOrientation) {
      sizePenalty *= 1.5;
    }

    // Ham Skor Hesaplama
    const rawScore = pwrToWeight * tractionFactor * chassisScore * (1 / sizePenalty);

    // Açıklama Metni Oluşturma
    let reason = [];
    if (vehicle.curb_weight_kg < 1300) reason.push("Hafif şasi");
    if (vehicle.drivetrain_stock === 'RWD' || vehicle.drivetrain_stock === 'AWD') reason.push(`${vehicle.drivetrain_stock} avantajı`);
    if (sizePenalty === 1.0) reason.push("Boyut uyumu mükemmel");
    if (chassisScore > 7) reason.push("Rijit şasi");

    return {
      vehicle,
      rawScore,
      reason: reason.join(", ") || "Dengeli özellikler"
    };
  });

  // Skoru 0-100 arasına normalize et
  const maxRawScore = Math.max(...scoredVehicles.map(v => v.rawScore));
  
  scoredVehicles.forEach(v => {
    v.score100 = Math.min(100, Math.round((v.rawScore / (maxRawScore || 1)) * 100));
  });

  // En yüksekten düşüğe sırala ve ilk 3'ü dön
  return scoredVehicles.sort((a, b) => b.score100 - a.score100).slice(0, 3);
}
