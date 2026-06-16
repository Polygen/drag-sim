/**
 * Uyarı Sistemi (Warning Engine)
 * Kullanıcının yaptığı konfigürasyonlardaki mantıksal, fiziksel ve mekanik uyumsuzlukları tespit eder.
 */

function extractNum(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

export function checkWarnings(vehicle, engine, transmission, conditions) {
  const warnings = [];

  if (!vehicle || !engine || !transmission) return warnings;

  const engineWidth = extractNum(engine.engine_width_mm);
  const engineLength = extractNum(engine.engine_length_mm);
  const engineHeight = extractNum(engine.engine_height_mm);
  
  const bayWidth = extractNum(vehicle.engine_bay_max_width_mm);
  const bayLength = extractNum(vehicle.engine_bay_max_length_mm);
  const bayHeight = extractNum(vehicle.engine_bay_max_displacement_cc); // Yükseklik verisi promptta ayrı verilmedi ama mantıksal kontrol

  // KONTROL 1: Fiziksel Boyut
  if (engineWidth > bayWidth) {
    warnings.push({
      level: 'warning', // yellow
      title: 'Motor Genişliği Uyumsuz',
      message: `Bu motor (${engineWidth}mm), araç motor yuvasına (${bayWidth}mm) SIĞMAZ. Gerçek uygulamada motor yuvası genişletmesi ve özel braketi gerekir. Tahmini ek maliyet: 5.000 - 20.000 TL`
    });
  }

  if (engineLength > bayLength) {
    warnings.push({
      level: 'warning',
      title: 'Motor Uzunluğu Fazla',
      message: `Motor derinliği (${engineLength}mm) araç değerine (${bayLength}mm) göre fazla. Radyatör pozisyonu veya ön çapraz desteği değiştirilmesi gerekebilir.`
    });
  }

  // KONTROL 2: Oryantasyon Uyumsuzluğu
  // FWD araçlar genelde transverse, RWD/AWD genelde longitudinal olur
  const expectedOrientation = vehicle.drivetrain_stock === 'FWD' ? 'transverse' : 'longitudinal';
  if (engine.orientation && engine.orientation !== expectedOrientation) {
    warnings.push({
      level: 'critical', // red
      title: 'Motor Yerleşimi Uyumsuz',
      message: `Bu motor ${engine.orientation === 'transverse' ? 'Enine (transverse)' : 'Boyuna (longitudinal)'} tasarlanmıştır. Bu araç ${expectedOrientation === 'transverse' ? 'enine' : 'boyuna'} yerleşim bekler. Swap ciddi müdahale gerektirir.`
    });
  }

  // KONTROL 3: Çekiş Uyumsuzluğu
  // Not: Simülatörde RWD motorunu FWD araca takmaya çalışmak genelde şanzıman ve aktarma değişimiyle mümkündür.
  
  // KONTROL 4: Ağırlık Uyarısı
  // Basitçe: 150kg referans
  if (engine.engine_weight_kg > 200 && vehicle.curb_weight_kg < 1300) {
    warnings.push({
      level: 'warning',
      title: 'Ağır Motor Swapı',
      message: `Bu motor araç stok motorundan muhtemelen oldukça ağır. Ön aks yük dağılımı ciddi oranda etkilenecek ve aracın yol tutuş dengesi bozulacaktır.`
    });
  }

  // KONTROL 5: Motor-Şanzıman Uyumu
  const engineMaxTorque = extractNum(engine.stock_torque_nm_at_rpm);
  if (transmission.max_torque_capacity_nm < engineMaxTorque) {
    warnings.push({
      level: 'critical',
      title: 'Şanzıman Kapasitesi Aşıldı',
      message: `ŞANZIMAN TORKU AŞILDI! Seçilen şanzıman (${transmission.max_torque_capacity_nm} Nm) bu torku (${engineMaxTorque} Nm) kaldıramaz. Şanzıman hasarı çok yüksek ihtimalle yaşanır.`
    });
  }

  // EK KONTROLLER (Bölüm 10 Dışı - Prompt İçi)
  if (conditions?.tireCompound?.id === 'tire_drag_slick' && conditions?.surfaceCondition === 'wet') {
    warnings.push({
      level: 'critical',
      title: 'HAYATİ TEHLİKE',
      message: 'Slick lastikle ıslak yolda kontrol kaybı garantidir. Simülasyon devam eder ama gerçekte bu kombinasyonu asla denemeyin.'
    });
  }

  if (conditions?.fuelType === 'E85') {
    warnings.push({
      level: 'warning',
      title: 'Yakıt Tedariği Zorluğu',
      message: 'E85 için enjektör boyutu %30 büyütülmeli. Ayrıca Türkiye\'de E85 yakıtına erişim sınırlıdır.'
    });
  }

  return warnings;
}
