import { simulateRunLight } from './simRunner.js';
import { calculateFitness } from './fitness.js';

// Range objesinden [min, min+step, ..., max] dizisi üretir.
function expandRange({ min, max, step }) {
  if (step <= 0 || min > max) return [min];
  const out = [];
  for (let v = min; v <= max + 0.0001; v += step) {
    out.push(Math.round(v));
  }
  return out;
}

// Cartesian product: tüm parametre kombinasyonlarını üretir.
// (drivetrain dahil tüm axis'ler)
function* cartesian(axes) {
  if (axes.length === 0) {
    yield {};
    return;
  }
  const [head, ...tail] = axes;
  for (const headVal of head.values) {
    for (const tailCombo of cartesian(tail)) {
      yield { ...tailCombo, [head.key]: headVal };
    }
  }
}

// Top-N (küçük liste) içine skor bazlı insert — her aday O(n).
// sigFn opsiyonel: diversity kontrolü için kullanılır. Eğer verilirse ve top-N doluysa,
// skor düşük olsa bile farklı signature'a sahip item en kötü item'ın yerini alabilir.
// Bu, "herkes aynı optimum slip noktasına yakınsıyor" durumunda top 5'te farklı
// setup kategorileri görmemizi sağlar.
function insertTopN(list, item, n, sigFn) {
  if (list.length < n) {
    return insertSorted(list, item, n);
  }
  if (item.score > list[n - 1].score) {
    return insertSorted(list, item, n);
  }
  // Skor düşük ama diversity kazandırıyor mu kontrol et
  if (sigFn) {
    const itemSig = sigFn(item);
    const hasSameSig = list.some((x) => sigFn(x) === itemSig);
    if (!hasSameSig) {
      // Farklı signature: en kötü item'ı at, yeni ekle
      const next = list.slice(0, n - 1);
      return insertSorted(next, item, n);
    }
  }
  return list;
}

function insertSorted(list, item, n) {
  const insertAt = list.findIndex((x) => item.score > x.score);
  const next = [...list];
  if (insertAt === -1) next.push(item);
  else next.splice(insertAt, 0, item);
  return next.slice(0, n);
}

// Diversity signature: HP/tork/weight dilimleri + drivetrain/surface/tire + launch gear.
// Dilimler default step'lere yakın (50/30/100); daha küçük cluster = daha fazla diversity.
// Aynı dilimdeki setup'lar "benzer" sayılır, farklı dilimdeki "farklı kategori" olur.
function diversitySignature(e) {
  const p = e.params;
  return [
    Math.round(p.hp / 50) * 50,
    Math.round(p.torque / 30) * 30,
    Math.round(p.weight / 100) * 100,
    p.drivetrain,
    p.surface,
    p.tire,
    p.launchGear || 1
  ].join('|');
}

const CHUNK_SIZE = 25;

// Async batch grid search. Ana thread'de çalışır, her CHUNK_SIZE sim'de
// browser'a bir frame çizme fırsatı verir → UI responsive kalır.
//
// Döner: { results, baseline, total, completed, cancelled }
export async function runGridSearch(baseCar, raceSettings, ranges, options = {}) {
  const { onProgress, signal, topN = 5 } = options;

  const hpValues = expandRange(ranges.hp);
  const tqValues = expandRange(ranges.torque);
  const wValues = expandRange(ranges.weight);
  const nosValues = expandRange(ranges.nos);
  const dtValues = ranges.drivetrains && ranges.drivetrains.length > 0
    ? ranges.drivetrains
    : [baseCar.drivetrain];
  const sfValues = ranges.surfaces && ranges.surfaces.length > 0
    ? ranges.surfaces
    : [raceSettings.surface];
  const trValues = ranges.tires && ranges.tires.length > 0
    ? ranges.tires
    : [raceSettings.tire];
  const lgValues = ranges.launchGears && ranges.launchGears.length > 0
    ? ranges.launchGears
    : [baseCar.launchGear || 1];

  const axes = [
    { key: 'hp', values: hpValues },
    { key: 'torque', values: tqValues },
    { key: 'weight', values: wValues },
    { key: 'nos', values: nosValues },
    { key: 'drivetrain', values: dtValues },
    { key: 'surface', values: sfValues },
    { key: 'tire', values: trValues },
    { key: 'launchGear', values: lgValues }
  ];

  // Tüm kombinasyonları say (UI'da "toplam X sim" göstermek için).
  const total = hpValues.length * tqValues.length * wValues.length * nosValues.length
    * dtValues.length * sfValues.length * trValues.length * lgValues.length;

  // Baseline: kullanıcının aracının değiştirilmemiş hali. Normalizasyon için referans.
  // Tek seferlik, en başta hesapla.
  const baseline = simulateRunLight(baseCar, raceSettings);

  const candidates = cartesian(axes);
  let topResults = [];
  let completed = 0;
  let cancelled = false;
  let bestSoFar = null;

  for (const combo of candidates) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    // baseCar ve raceSettings'i immutable tut, her aday için yeni objeler.
    const candidateCar = {
      ...baseCar,
      hp: combo.hp,
      torque: combo.torque,
      weight: combo.weight,
      nosShot: combo.nos,
      drivetrain: combo.drivetrain,
      launchGear: combo.launchGear
    };
    const candidateSettings = {
      ...raceSettings,
      surface: combo.surface,
      tire: combo.tire
    };

    let result;
    try {
      result = simulateRunLight(candidateCar, candidateSettings);
    } catch {
      // Simülasyon patlarsa (örn. geçersiz config) bu adayı atla, devam et.
      completed++;
      continue;
    }

    const score = calculateFitness(result, baseline, {
      targetTime_s: ranges.targetTime_s ?? null,
      maxSlip_s: ranges.maxSlip_s ?? null
    });
    const entry = {
      params: combo,
      result,
      score,
      car: candidateCar,
      settings: candidateSettings
    };
    topResults = insertTopN(topResults, entry, topN, diversitySignature);

    if (!bestSoFar || score > bestSoFar.score) {
      bestSoFar = entry;
    }

    completed++;

    // Her sim'den sonra değil, her CHUNK_SIZE sim'de bir yield — gereksiz yere
    // mikro-task kuyruğu şişmesin. 25 sim × ~10sn = ~250sn UI freeze olurdu.
    if (completed % CHUNK_SIZE === 0) {
      if (onProgress) {
        onProgress({ completed, total, bestSoFar, topResults: [...topResults] });
      }
      // Tarayıcıya bir frame çizme fırsatı ver.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Son progress callback — toplamı garantile.
  if (onProgress) {
    onProgress({ completed, total, bestSoFar, topResults: [...topResults] });
  }

  return {
    results: topResults,
    baseline,
    total,
    completed,
    cancelled
  };
}
