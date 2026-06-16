// ============================================================
//  Fitness Skor Fonksiyonu (drag racing — kısıt tabanlı)
// ============================================================
//
// calculateFitness, bir setup'ın hedefleri karşılayıp karşılamadığını ve
// kısıtlar içindeyken ne kadar iyi olduğunu hesaplar.
//
// --- input şekli ---
//   result   = simulateRunLight çıktısı:
//              { elapsed_time_s, speed_at_end_kmh, split_60ft_s, split_330ft_s,
//                total_slip_time_s, slip_events, gear_shifts, mode_target_met }
//
//   baseline = kullanıcının aracının değiştirilmemiş halinin simülasyon sonucu.
//              (Fonksiyon doğrudan kullanmıyor; panel referans göstermek için tutar.)
//
//   options  = {
//     targetTime_s: Number|null,  null → sınır yok; Number → ET bu değerin altında olmalı
//     maxSlip_s:    Number|null   null → sınır yok; Number → slip bu değerin altında olmalı
//   }
//
// --- return ---
//   YÜKSEK skor = iyi setup. -1000 = DNF veya kısıtı ihlal eden (grid search eler).
//   Kısıtları geçenlerde skor = 1 / max(slip, 0.05) — en düşük slip = en yüksek skor.
//
// --- kısıt ihlali sırası ---
//   1. mode_target_met değil → -1000 (DNF — yarışı bitiremedi)
//   2. targetTime_s varsa ve elapsed_time_s onu aşıyorsa → -1000
//   3. maxSlip_s varsa ve total_slip_time_s onu aşıyorsa → -1000
//
// --- drag racing domain notu ---
//   1/slip skorlamasının sebebi: hedefi geçen setup'lar arasında "doğru traction"
//   en önemli fark yaratır. HP/NOS arttıkça slip doğal olarak yükselir; 1/slip
//   bunu cezalandırır. Slip=0.05 (perfect launch) skor=20, slip=0.5 skor=2,
//   slip=1.0 skor=1 — oranlı ve sezgisel.
//
//   Hedef süre yoksa (Top Speed modu gibi) sadece slip minimize edilir.

export function calculateFitness(result, baseline, options = {}) {
  const { targetTime_s = null, maxSlip_s = null } = options;

  if (!result.mode_target_met) return -1000;
  if (targetTime_s != null && result.elapsed_time_s > targetTime_s) return -1000;
  if (maxSlip_s != null && result.total_slip_time_s > maxSlip_s) return -1000;

  const safeSlip = Math.max(result.total_slip_time_s, 0.05);
  return 1 / safeSlip;
}
