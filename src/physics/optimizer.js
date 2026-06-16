import { simulate } from './simulation.js';

export async function runOptimization(carConfig, mode, maxHpLimit, maxTqLimit, maxRpm, progressCallback) {
  // mode: '400m', '800m', '0-100', '100-200'
  
  const surfaces = [
    { id: 'vht', name: 'Drag Pisti (VHT)', mu: 1.2 },
    { id: 'good_asphalt', name: 'Kaliteli Asfalt', mu: 1.0 },
    { id: 'turkey_asphalt', name: 'Türkiye Asfaltı', mu: 0.7 }
  ];

  const tires = [
    { id: 'slick', name: 'Slick', tractionFactor: 1.3 },
    { id: 'semi_slick', name: 'Semi-Slick', tractionFactor: 1.15 },
    { id: 'street', name: 'Street', tractionFactor: 0.8 }
  ];

  const hpStart = 50;
  const hpEnd = maxHpLimit;
  const hpStep = 20; // Grafikte daha detaylı aralık görmek için 20 yaptık

  const tqStart = 50;
  const tqEnd = maxTqLimit;
  const tqStep = 20; // Kullanıcı torkun da 20'şer artmasını istedi

  // Gerçekçilik kısıtı için orijinal aracın tork/hp oranını bul (parseInt ile stringleri düzeltiyoruz)
  const parseValue = (val) => {
    if (!val) return 1;
    if (typeof val === 'string') return parseInt(val.split('@')[0]) || 1;
    return val;
  };
  
  const baseHp = parseValue(carConfig.engine?.stock_hp_at_rpm) || parseValue(carConfig.hp) || 1;
  const baseTq = parseValue(carConfig.engine?.stock_torque_nm_at_rpm) || parseValue(carConfig.torque) || 1;
  const baseRatio = baseTq / baseHp;

  // Devir değiştiğinde güç üretmek için gereken tork miktarı değişir. (HP = Tq * RPM / 7120)
  // Devir arttıkça aynı gücü daha düşük torkla alabiliriz, bu yüzden fiziksel kısıtı yeni devire göre esnetiyoruz.
  const stockRedline = carConfig.engine?.redline_rpm || 7500;
  const rpmStretch = maxRpm / stockRedline;
  const adjustedBaseRatio = baseRatio / rpmStretch;

  // Fiziksel limit hesabı için tepe gücünün üretildiği devri baştan hesaplayalım
  let globalPeakHpRpm = maxRpm * 0.85;
  let globalPeakTqRpm = maxRpm * 0.55;
  let maxStockHpVal = 0;
  let maxStockTqVal = 0;

  if (carConfig.engine && carConfig.engine.torque_curve_rpm_points) {
    carConfig.engine.torque_curve_rpm_points.forEach(p => {
      const stretchedRpm = p.rpm * rpmStretch;
      if (p.nm > maxStockTqVal) { maxStockTqVal = p.nm; globalPeakTqRpm = stretchedRpm; }
      const hpAtRpm = (p.nm * stretchedRpm) / 7120.9;
      if (hpAtRpm > maxStockHpVal) { maxStockHpVal = hpAtRpm; globalPeakHpRpm = stretchedRpm; }
    });
    if (globalPeakHpRpm <= globalPeakTqRpm) globalPeakHpRpm = globalPeakTqRpm + 1000;
  }

  const results = {};

  surfaces.forEach(surface => {
    results[surface.id] = {
      surfaceName: surface.name,
      bestSetup: null,
      sensibleSetup: null,
      data: [] // Graph data
    };
  });

  const hpStepsCount = Math.floor((hpEnd - hpStart) / hpStep) + 1;
  const tqStepsCount = Math.floor((tqEnd - tqStart) / tqStep) + 1;
  const totalSteps = surfaces.length * tires.length * hpStepsCount * tqStepsCount;
  let currentStep = 0;

  // Arayüzün donmaması için her batch sonrasında UI'ye nefes aldıracağız
  const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

  for (const surface of surfaces) {
    const surfaceDataPoints = []; // [{hp, tq, tireId, time}]

    for (let hp = hpStart; hp <= hpEnd; hp += hpStep) {
      for (let tq = tqStart; tq <= tqEnd; tq += tqStep) {
        
        // Çok absürt oranları elemeli miyiz? Evet!
        // Matematiksel kesin kural: Beygir gücü = (Tork * Devir) / 7120.9
        // Eğer hedeflediğimiz HP'yi, tepe gücü devrinde (globalPeakHpRpm) elde edeceksek, oradaki Tork'un
        // "absoluteMinTq" kadar olması ZORUNLUDUR. Test edilen 'tq' eğer bundan küçükse, motor o beygiri üretemez!
        const absoluteMinTq = (hp * 7120.9) / globalPeakHpRpm;

        // Bir motor bloğunun karakteristiği gereği beygir ve tork birbirine belli oranda bağlıdır (gerçekçilik kısıtı)
        const minTq = Math.max(absoluteMinTq, hp * (adjustedBaseRatio * 0.6));
        const maxTq = hp * (adjustedBaseRatio * 1.5); 

        if (tq < minTq || tq > maxTq) {
          currentStep += tires.length;
          continue; 
        }

        for (const tire of tires) {
          // Tork eğrisi hesapla (Kullanıcı ayrı ayrı dene dediği için stock curve'u stretch edeceğiz)
          let mappedTqCurve = [];
          if (carConfig.engine && carConfig.engine.torque_curve_rpm_points) {
            const hpRatio = hp / maxStockHpVal;
            const tqRatio = tq / maxStockTqVal;

            mappedTqCurve = carConfig.engine.torque_curve_rpm_points.map(p => {
              const stretchedRpm = p.rpm * rpmStretch;
              let scale;
              if (stretchedRpm <= globalPeakTqRpm) {
                scale = tqRatio;
              } else if (stretchedRpm >= globalPeakHpRpm) {
                scale = hpRatio;
              } else {
                const fraction = (stretchedRpm - globalPeakTqRpm) / (globalPeakHpRpm - globalPeakTqRpm);
                scale = tqRatio + fraction * (hpRatio - tqRatio);
              }
              return { rpm: stretchedRpm, nm: p.nm * scale };
            });
          } else {
            const tqAtPeakHp = (hp * 7120.9) / globalPeakHpRpm;

            mappedTqCurve = [
               maxRpm * 0.125, maxRpm * 0.25, maxRpm * 0.375, 
               globalPeakTqRpm, 
               maxRpm * 0.65, globalPeakHpRpm, 
               maxRpm * 0.95, maxRpm
            ].map(rpm => {
              let nm = 0;
              if (rpm <= globalPeakTqRpm) {
                 nm = tq * 0.7 + (tq * 0.3) * (rpm / globalPeakTqRpm);
              } else if (rpm <= globalPeakHpRpm) {
                 const ratio = (rpm - globalPeakTqRpm) / (globalPeakHpRpm - globalPeakTqRpm);
                 nm = tq - (tq - tqAtPeakHp) * ratio;
              } else {
                 const ratio = (rpm - globalPeakHpRpm) / (maxRpm - globalPeakHpRpm);
                 nm = tqAtPeakHp * (1 - ratio * 0.3);
              }
              return { rpm, nm };
            });
          }

          const gearRatios = carConfig.transmission?.gear_ratios || [3.5, 2.0, 1.4, 1.0, 0.8, 0.6];
          const finalDrive = carConfig.transmission?.final_drive_ratio || 3.5;
          const shiftTime = carConfig.transmission?.shift_time_ms || (carConfig.transmissionType === 'Auto' ? 100 : 300);
          const eff = carConfig.transmission?.efficiency_pct || (carConfig.transmissionType === 'Auto' ? 90 : 95);
          
          // Kalkış devri, max devrin %45'i kadar olsun ama 1000'den az olmasın
          const customLaunchRpm = Math.max(1000, maxRpm * 0.45);

          const simConfig = {
            raceMode: mode,
            weightKg: carConfig.weight,
            weightDistFrontPct: carConfig.drivetrain === 'FWD' ? 62 : 50,
            drivetrain: carConfig.drivetrain,
            wheelbaseM: 2.5,
            cogHeightM: 0.5,
            dragCoefficient: 0.30,
            frontalAreaM2: 2.2,
            rollingResistanceCoefficient: 0.012,
            tireRadiusM: 0.32,
            redlineRpm: maxRpm,
            idleRpm: carConfig.engine?.idle_rpm || 800,
            launchRpm: customLaunchRpm,
            gearRatios,
            finalDriveRatio: finalDrive,
            shiftTimeMs: shiftTime,
            efficiencyPct: eff,
            
            mu: surface.mu,
            tractionFactor: tire.tractionFactor,
            temperatureC: 20,
            altitudeM: 0,
            
            torqueCurve: mappedTqCurve,
            nosShot: 0, 
            topSpeedKmh: carConfig.hasLimiter !== false ? (carConfig.top_speed_kmh || 350) : null
          };

          const res = simulate(simConfig);
          
          surfaceDataPoints.push({
            hp,
            tq,
            tire: tire.name,
            time: res.elapsed_time_s,
            speed: res.speed_at_end_kmh,
            slip: res.total_slip_time_s,
            targetMet: res.mode_target_met
          });

          currentStep++;
        }
      }
      // Her HP adımında (Tork + Lastik bitince) UI'yi güncelle ve kilitleme
      if (progressCallback) {
        progressCallback(currentStep / totalSteps);
      }
      await yieldToMain();
    }

    // Bu zemin için verileri analiz et
    let bestAbsoluteTime = Infinity;
    let bestAbsoluteSetup = null;

    // Grafiğe aktarmak için (HP sabitken o HP'deki en iyi süreyi bulalım)
    // Çünkü artık 2D grid var, her HP'de birden fazla tork var. Grafikte "Belirli bir HP'de ulaşılabilen en iyi süre" gösterilmeli.
    const graphDataMap = {}; // key: hp

    surfaceDataPoints.forEach(pt => {
      if (pt.targetMet) {
        // En iyiyi bul
        if (pt.time < bestAbsoluteTime) {
          bestAbsoluteTime = pt.time;
          bestAbsoluteSetup = pt;
        }

        // Grafiğe veri hazırla
        if (!graphDataMap[pt.hp]) {
          graphDataMap[pt.hp] = { hp: pt.hp };
        }
        
        // Bu HP'de bu lastikle kaydedilmiş bir süre var mı? Yoksa veya yenisi daha iyiyse kaydet
        if (!graphDataMap[pt.hp][pt.tire] || pt.time < graphDataMap[pt.hp][pt.tire]) {
          graphDataMap[pt.hp][pt.tire] = pt.time;
          graphDataMap[pt.hp][pt.tire + '_tq'] = pt.tq; // En iyi süreyi veren Tork değerini de kaydet
        }
      }
    });

    const graphDataArray = Object.values(graphDataMap).sort((a, b) => a.hp - b.hp);
    results[surface.id].data = graphDataArray;
    results[surface.id].bestSetup = bestAbsoluteSetup;

    // Sensible Setup (Mantıklı Setup) Bulma
    // Kullanıcı talebi: +0.2 saniye tolerans
    if (bestAbsoluteSetup) {
      let sensibleSetup = bestAbsoluteSetup;
      const timeThreshold = bestAbsoluteSetup.time + 0.20; // 0.20s tolerans
      const hpThreshold = bestAbsoluteSetup.hp - 150; // En az 150 HP daha düşük olmalı

      // Tüm noktaları süreye göre sıralayıp, HP'si düşük olanları bulabiliriz
      // Veya direkt HP'ye göre artan sırada tarayıp timeThreshold altına inen ilki alabiliriz
      // Ancak "HP + Tork" kombosunda mantıklı olanı bulmalıyız. 
      // Şartlar: HP <= hpThreshold VE time <= timeThreshold. Bu şartları sağlayanlar arasında "en düşük HP"li olanı bulalım.
      
      let candidate = null;
      for (const pt of surfaceDataPoints) {
        if (pt.targetMet && pt.hp <= hpThreshold && pt.time <= timeThreshold) {
          if (!candidate || pt.hp < candidate.hp || (pt.hp === candidate.hp && pt.time < candidate.time)) {
            candidate = pt;
          }
        }
      }

      if (candidate) {
        results[surface.id].sensibleSetup = candidate;
      }
    }
  }

  if (progressCallback) progressCallback(1.0);
  return results;
}

