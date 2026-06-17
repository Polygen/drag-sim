import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to expand compact car data into full JSON
function expandCars(make, arr) {
  return arr.map(c => ({
    make: make,
    model: c.model,
    year_range: c.yr,
    body_style: c.type,
    curb_weight_kg: c.w,
    weight_distribution_front_pct: c.wd,
    drivetrain_stock: c.d,
    wheelbase_mm: c.wb,
    track_width_front_mm: c.tw || 1500,
    track_width_rear_mm: c.tw || 1500,
    engine_bay_max_displacement_cc: (c.d === 'RWD' || c.d === 'AWD') ? 7000 : 3500,
    engine_bay_max_width_mm: c.d === 'FWD' ? 750 : 900,
    engine_bay_max_length_mm: c.d === 'FWD' ? 650 : 1000,
    stock_engine_code: c.ec,
    stock_hp: c.hp,
    stock_torque_nm: c.tq,
    stock_transmission: c.tr,
    chassis_rigidity_score: c.r,
    aero_drag_coefficient: c.cx,
    frontal_area_m2: c.fa,
    fuel_tank_capacity_l: c.ft,
    notes: c.n || "Standart üretim."
  }));
}

// Compact arrays for each brand
const peugeot = [
  { model: "207 RC", yr: "2006-2012", type: "hatchback", w: 1250, wd: 63, d: "FWD", wb: 2540, tw: 1474, hp: 175, tq: 240, ec: "1.6 THP (EP6DTS)", tr: "5-speed Manual", r: 4, cx: 0.31, fa: 2.10, ft: 50 },
  { model: "RCZ", yr: "2010-2015", type: "coupe", w: 1297, wd: 62, d: "FWD", wb: 2612, tw: 1580, hp: 200, tq: 275, ec: "1.6 THP (EP6CDTX)", tr: "6-speed Manual", r: 6, cx: 0.32, fa: 2.15, ft: 55 },
  { model: "206 GTi", yr: "1999-2006", type: "hatchback", w: 1050, wd: 64, d: "FWD", wb: 2442, tw: 1437, hp: 136, tq: 190, ec: "EW10J4", tr: "5-speed Manual", r: 3, cx: 0.33, fa: 2.05, ft: 50 },
  { model: "308 GTi", yr: "2015-2020", type: "hatchback", w: 1205, wd: 62, d: "FWD", wb: 2620, tw: 1559, hp: 270, tq: 330, ec: "1.6 THP (EP6FDTR)", tr: "6-speed Manual", r: 6, cx: 0.31, fa: 2.20, ft: 53 }
];

const bmw = [
  { model: "M3 E30", yr: "1986-1991", type: "coupe", w: 1200, wd: 52, d: "RWD", wb: 2562, tw: 1412, hp: 200, tq: 240, ec: "S14B23", tr: "5-speed Manual", r: 5, cx: 0.33, fa: 1.95, ft: 55 },
  { model: "325i E30", yr: "1985-1991", type: "sedan", w: 1180, wd: 53, d: "RWD", wb: 2570, tw: 1407, hp: 170, tq: 222, ec: "M20B25", tr: "5-speed Manual", r: 4, cx: 0.36, fa: 1.90, ft: 55 },
  { model: "328i E36", yr: "1995-1999", type: "coupe", w: 1395, wd: 50, d: "RWD", wb: 2700, tw: 1408, hp: 193, tq: 280, ec: "M52B28", tr: "5-speed Manual", r: 5, cx: 0.31, fa: 1.90, ft: 65 },
  { model: "M3 E36", yr: "1992-1999", type: "coupe", w: 1460, wd: 50, d: "RWD", wb: 2700, tw: 1422, hp: 286, tq: 320, ec: "S50B30", tr: "5-speed Manual", r: 6, cx: 0.32, fa: 1.95, ft: 65 },
  { model: "M3 E46", yr: "2000-2006", type: "coupe", w: 1549, wd: 50, d: "RWD", wb: 2731, tw: 1508, hp: 343, tq: 365, ec: "S54B32", tr: "6-speed Manual", r: 7, cx: 0.32, fa: 2.05, ft: 63 },
  { model: "M3 E92", yr: "2007-2013", type: "coupe", w: 1655, wd: 51, d: "RWD", wb: 2761, tw: 1538, hp: 420, tq: 400, ec: "S65B40", tr: "6-speed DCT", r: 8, cx: 0.31, fa: 2.17, ft: 63 },
  { model: "335i F30", yr: "2011-2015", type: "sedan", w: 1585, wd: 50, d: "RWD", wb: 2810, tw: 1543, hp: 306, tq: 400, ec: "N55B30", tr: "8-speed Auto", r: 7, cx: 0.29, fa: 2.20, ft: 60 },
  { model: "M5 E34", yr: "1988-1995", type: "sedan", w: 1650, wd: 51, d: "RWD", wb: 2761, tw: 1470, hp: 315, tq: 360, ec: "S38B36", tr: "5-speed Manual", r: 5, cx: 0.32, fa: 2.10, ft: 90 },
  { model: "M5 E39", yr: "1998-2003", type: "sedan", w: 1795, wd: 52, d: "RWD", wb: 2830, tw: 1515, hp: 400, tq: 500, ec: "S62B50", tr: "6-speed Manual", r: 6, cx: 0.31, fa: 2.20, ft: 70 },
  { model: "M5 E60", yr: "2004-2010", type: "sedan", w: 1830, wd: 52, d: "RWD", wb: 2889, tw: 1580, hp: 507, tq: 520, ec: "S85B50", tr: "7-speed SMG", r: 7, cx: 0.31, fa: 2.25, ft: 70 }
];

const mazda = [
  { model: "MX-5 ND", yr: "2015-2025", type: "convertible", w: 1058, wd: 50, d: "RWD", wb: 2310, tw: 1495, hp: 184, tq: 205, ec: "Skyactiv-G 2.0", tr: "6-speed Manual", r: 8, cx: 0.34, fa: 1.85, ft: 45 },
  { model: "RX-7 FD", yr: "1991-2002", type: "coupe", w: 1310, wd: 50, d: "RWD", wb: 2425, tw: 1460, hp: 255, tq: 294, ec: "13B-REW", tr: "5-speed Manual", r: 6, cx: 0.31, fa: 1.80, ft: 76 },
  { model: "RX-8", yr: "2003-2012", type: "coupe", w: 1380, wd: 50, d: "RWD", wb: 2700, tw: 1500, hp: 231, tq: 211, ec: "13B-MSP", tr: "6-speed Manual", r: 7, cx: 0.30, fa: 1.95, ft: 61 },
  { model: "3 MPS", yr: "2006-2013", type: "hatchback", w: 1485, wd: 63, d: "FWD", wb: 2640, tw: 1535, hp: 260, tq: 380, ec: "MZR 2.3 DISI", tr: "6-speed Manual", r: 6, cx: 0.32, fa: 2.15, ft: 55 }
];

const vw = [
  { model: "Golf Mk4 GTI", yr: "1997-2004", type: "hatchback", w: 1250, wd: 62, d: "FWD", wb: 2511, tw: 1513, hp: 150, tq: 210, ec: "1.8T 20V", tr: "5-speed Manual", r: 4, cx: 0.31, fa: 2.05, ft: 55 },
  { model: "Golf Mk5 GTI", yr: "2004-2009", type: "hatchback", w: 1336, wd: 62, d: "FWD", wb: 2578, tw: 1534, hp: 200, tq: 280, ec: "EA113 2.0 TFSI", tr: "6-speed DSG", r: 6, cx: 0.32, fa: 2.10, ft: 55 },
  { model: "Golf Mk6 GTI", yr: "2008-2013", type: "hatchback", w: 1360, wd: 61, d: "FWD", wb: 2578, tw: 1533, hp: 210, tq: 280, ec: "EA888 Gen2", tr: "6-speed DSG", r: 6, cx: 0.31, fa: 2.15, ft: 55 },
  { model: "Golf Mk7 GTI", yr: "2012-2019", type: "hatchback", w: 1351, wd: 61, d: "FWD", wb: 2631, tw: 1538, hp: 220, tq: 350, ec: "EA888 Gen3", tr: "6-speed DSG", r: 7, cx: 0.31, fa: 2.19, ft: 50 },
  { model: "Golf Mk7 R", yr: "2013-2019", type: "hatchback", w: 1476, wd: 59, d: "AWD", wb: 2626, tw: 1538, hp: 300, tq: 380, ec: "EA888 Gen3 R", tr: "6-speed DSG", r: 7, cx: 0.32, fa: 2.19, ft: 55 },
  { model: "Golf Mk4 R32", yr: "2002-2004", type: "hatchback", w: 1477, wd: 60, d: "AWD", wb: 2518, tw: 1513, hp: 241, tq: 320, ec: "3.2 VR6", tr: "6-speed Manual", r: 5, cx: 0.32, fa: 2.05, ft: 62 }
];

const evo = [
  { model: "Lancer Evo VI", yr: "1999-2001", type: "sedan", w: 1360, wd: 60, d: "AWD", wb: 2510, tw: 1515, hp: 280, tq: 373, ec: "4G63T", tr: "5-speed Manual", r: 6, cx: 0.36, fa: 2.00, ft: 50 },
  { model: "Lancer Evo VIII", yr: "2003-2005", type: "sedan", w: 1410, wd: 60, d: "AWD", wb: 2625, tw: 1515, hp: 280, tq: 392, ec: "4G63T", tr: "6-speed Manual", r: 7, cx: 0.35, fa: 2.05, ft: 55 },
  { model: "Lancer Evo IX", yr: "2005-2007", type: "sedan", w: 1465, wd: 60, d: "AWD", wb: 2625, tw: 1515, hp: 286, tq: 392, ec: "4G63T MIVEC", tr: "6-speed Manual", r: 8, cx: 0.35, fa: 2.05, ft: 55 },
  { model: "Lancer Evo X", yr: "2008-2016", type: "sedan", w: 1540, wd: 58, d: "AWD", wb: 2650, tw: 1545, hp: 295, tq: 366, ec: "4B11T", tr: "6-speed SST", r: 9, cx: 0.34, fa: 2.20, ft: 55 }
];

const nissan = [
  { model: "GT-R R35", yr: "2007-2016", type: "coupe", w: 1740, wd: 53, d: "AWD", wb: 2780, tw: 1590, hp: 480, tq: 588, ec: "VR38DETT", tr: "6-speed DCT", r: 9, cx: 0.27, fa: 2.25, ft: 74 },
  { model: "Skyline GT-R R34", yr: "1999-2002", type: "coupe", w: 1560, wd: 55, d: "AWD", wb: 2665, tw: 1480, hp: 280, tq: 392, ec: "RB26DETT", tr: "6-speed Manual", r: 7, cx: 0.33, fa: 2.05, ft: 65 },
  { model: "Skyline GT-R R32", yr: "1989-1994", type: "coupe", w: 1430, wd: 57, d: "AWD", wb: 2615, tw: 1480, hp: 280, tq: 353, ec: "RB26DETT", tr: "5-speed Manual", r: 5, cx: 0.40, fa: 2.00, ft: 72 },
  { model: "350Z", yr: "2002-2009", type: "coupe", w: 1530, wd: 53, d: "RWD", wb: 2650, tw: 1535, hp: 280, tq: 363, ec: "VQ35DE", tr: "6-speed Manual", r: 6, cx: 0.30, fa: 2.10, ft: 80 },
  { model: "Silvia S15", yr: "1999-2002", type: "coupe", w: 1250, wd: 53, d: "RWD", wb: 2525, tw: 1480, hp: 250, tq: 275, ec: "SR20DET", tr: "6-speed Manual", r: 5, cx: 0.33, fa: 1.95, ft: 65 }
];

const toyota = [
  { model: "Supra A80", yr: "1993-2002", type: "coupe", w: 1490, wd: 53, d: "RWD", wb: 2550, tw: 1520, hp: 320, tq: 427, ec: "2JZ-GTE", tr: "6-speed Manual", r: 7, cx: 0.31, fa: 1.88, ft: 70 },
  { model: "GR Supra A90", yr: "2019-Günümüz", type: "coupe", w: 1495, wd: 50, d: "RWD", wb: 2470, tw: 1594, hp: 340, tq: 500, ec: "B58B30", tr: "8-speed Auto", r: 9, cx: 0.29, fa: 2.05, ft: 52 },
  { model: "GT86", yr: "2012-2021", type: "coupe", w: 1240, wd: 53, d: "RWD", wb: 2570, tw: 1520, hp: 200, tq: 205, ec: "FA20", tr: "6-speed Manual", r: 7, cx: 0.27, fa: 1.90, ft: 50 },
  { model: "GR Yaris (2026 Facelift)", yr: "2024-Günümüz", type: "hatchback", w: 1280, wd: 60, d: "AWD", wb: 2560, tw: 1530, hp: 280, tq: 390, ec: "G16E-GTS", tr: "8-speed Auto", r: 9, cx: 0.35, fa: 2.10, ft: 50 }
];

const subaru = [
  { model: "Impreza WRX STI (GC8)", yr: "1994-2000", type: "sedan", w: 1250, wd: 58, d: "AWD", wb: 2520, tw: 1465, hp: 280, tq: 353, ec: "EJ207", tr: "5-speed Manual", r: 5, cx: 0.35, fa: 2.00, ft: 50 },
  { model: "Impreza WRX STI (GD)", yr: "2000-2007", type: "sedan", w: 1495, wd: 59, d: "AWD", wb: 2540, tw: 1490, hp: 300, tq: 407, ec: "EJ257", tr: "6-speed Manual", r: 6, cx: 0.33, fa: 2.05, ft: 60 },
  { model: "WRX STI (VA)", yr: "2014-2021", type: "sedan", w: 1525, wd: 59, d: "AWD", wb: 2650, tw: 1530, hp: 300, tq: 407, ec: "EJ257", tr: "6-speed Manual", r: 8, cx: 0.32, fa: 2.15, ft: 60 }
];

const audi = [
  { model: "TT 8N", yr: "1998-2006", type: "coupe", w: 1395, wd: 60, d: "AWD", wb: 2422, tw: 1528, hp: 225, tq: 280, ec: "1.8T 20V BAM", tr: "6-speed Manual", r: 5, cx: 0.34, fa: 1.95, ft: 62 },
  { model: "RS3 8V", yr: "2015-2020", type: "hatchback", w: 1520, wd: 59, d: "AWD", wb: 2631, tw: 1559, hp: 400, tq: 480, ec: "2.5 TFSI DAZA", tr: "7-speed S-Tronic", r: 8, cx: 0.32, fa: 2.20, ft: 55 },
  { model: "RS6 Avant C8", yr: "2020-2025", type: "wagon", w: 2075, wd: 55, d: "AWD", wb: 2928, tw: 1668, hp: 600, tq: 800, ec: "4.0 TFSI V8", tr: "8-speed Auto", r: 9, cx: 0.35, fa: 2.35, ft: 73 },
  { model: "R8 Gen1", yr: "2007-2015", type: "coupe", w: 1560, wd: 44, d: "AWD", wb: 2650, tw: 1632, hp: 420, tq: 430, ec: "4.2 FSI V8", tr: "6-speed R-Tronic", r: 9, cx: 0.34, fa: 2.00, ft: 75 }
];

const porsche = [
  { model: "911 Turbo S (992)", yr: "2020-2025", type: "coupe", w: 1640, wd: 39, d: "AWD", wb: 2450, tw: 1583, hp: 650, tq: 800, ec: "3.8 Boxer-6 TT", tr: "8-speed PDK", r: 10, cx: 0.33, fa: 2.10, ft: 67 }
];

const mercedes = [
  { model: "A45 AMG S", yr: "2019-2024", type: "hatchback", w: 1635, wd: 60, d: "AWD", wb: 2729, tw: 1585, hp: 421, tq: 500, ec: "M139 2.0T", tr: "8-speed DCT", r: 8, cx: 0.33, fa: 2.20, ft: 51 },
  { model: "E63s AMG (W213)", yr: "2017-2023", type: "sedan", w: 1950, wd: 54, d: "AWD", wb: 2939, tw: 1626, hp: 612, tq: 850, ec: "M177 4.0 V8 BiTurbo", tr: "9-speed MCT", r: 9, cx: 0.32, fa: 2.30, ft: 66 }
];

const others = [
  { model: "Civic Type R EK9", yr: "1997-2000", type: "hatchback", w: 1050, wd: 62, d: "FWD", wb: 2620, tw: 1480, hp: 185, tq: 160, ec: "B16B", tr: "5-speed Manual", r: 4, cx: 0.32, fa: 1.95, ft: 45 },
  { model: "Civic Type R FK8", yr: "2017-2021", type: "hatchback", w: 1380, wd: 62, d: "FWD", wb: 2699, tw: 1584, hp: 320, tq: 400, ec: "K20C1", tr: "6-speed Manual", r: 8, cx: 0.33, fa: 2.20, ft: 46 },
  { model: "S2000", yr: "1999-2009", type: "convertible", w: 1250, wd: 50, d: "RWD", wb: 2400, tw: 1470, hp: 240, tq: 208, ec: "F20C", tr: "6-speed Manual", r: 7, cx: 0.33, fa: 1.85, ft: 50 }
];

const allVehicles = [
  ...expandCars("Peugeot", peugeot),
  ...expandCars("BMW", bmw),
  ...expandCars("Mazda", mazda),
  ...expandCars("VW", vw),
  ...expandCars("Mitsubishi", evo),
  ...expandCars("Nissan", nissan),
  ...expandCars("Toyota", toyota),
  ...expandCars("Subaru", subaru),
  ...expandCars("Audi", audi),
  ...expandCars("Porsche", porsche),
  ...expandCars("Mercedes-AMG", mercedes),
  ...expandCars("Honda", others)
];

// Write vehicles
fs.writeFileSync(path.join(__dirname, 'vehicles.json'), JSON.stringify(allVehicles, null, 2));

// For engines and transmissions, we just reuse the ones from before, but add the new ones automatically based on stock values.
// In a full system we would have real power curves, but for this simulation we can generate a normalized power curve based on HP/TQ
function generateEngineDB(vehicles) {
  const engines = [];
  const addedCodes = new Set();
  
  const engineSpecs = {
    "1.6 THP (EP6DTS)": { cc: 1598, w: 115 }, "1.6 THP (EP6CDTX)": { cc: 1598, w: 115 }, "EW10J4": { cc: 1997, w: 135 }, "1.6 THP (EP6FDTR)": { cc: 1598, w: 115 },
    "S14B23": { cc: 2302, w: 150 }, "M20B25": { cc: 2494, w: 175 }, "M52B28": { cc: 2793, w: 165 }, "S50B30": { cc: 2990, w: 180 },
    "S54B32": { cc: 3246, w: 212 }, "S65B40": { cc: 3999, w: 202 }, "N55B30": { cc: 2979, w: 190 }, "S38B36": { cc: 3535, w: 235 },
    "S62B50": { cc: 4941, w: 240 }, "S85B50": { cc: 4999, w: 240 }, "Skyactiv-G 2.0": { cc: 1998, w: 115 },
    "13B-REW": { cc: 1308, w: 112 }, "13B-MSP": { cc: 1308, w: 112 }, "MZR 2.3 DISI": { cc: 2261, w: 155 },
    "1.8T 20V": { cc: 1781, w: 145 }, "EA113 2.0 TFSI": { cc: 1984, w: 152 }, "EA888 Gen2": { cc: 1984, w: 135 },
    "EA888 Gen3": { cc: 1984, w: 135 }, "EA888 Gen3 R": { cc: 1984, w: 135 }, "3.2 VR6": { cc: 3189, w: 185 },
    "4G63T": { cc: 1997, w: 160 }, "4G63T MIVEC": { cc: 1997, w: 165 }, "4B11T": { cc: 1998, w: 150 },
    "VR38DETT": { cc: 3799, w: 276 }, "RB26DETT": { cc: 2568, w: 250 }, "VQ35DE": { cc: 3498, w: 180 },
    "SR20DET": { cc: 1998, w: 149 }, "2JZ-GTE": { cc: 2997, w: 230 }, "B58B30": { cc: 2998, w: 139 },
    "FA20": { cc: 1998, w: 160 }, "G16E-GTS": { cc: 1618, w: 109 }, "EJ207": { cc: 1994, w: 160 },
    "EJ257": { cc: 2457, w: 165 }, "1.8T 20V BAM": { cc: 1781, w: 145 }, "2.5 TFSI DAZA": { cc: 2480, w: 160 },
    "4.2 FSI V8": { cc: 4163, w: 198 }, "4.0 TFSI V8": { cc: 3996, w: 220 }, "3.8 Boxer-6 TT": { cc: 3745, w: 195 },
    "M139 2.0T": { cc: 1991, w: 160 }, "M177 4.0 V8 BiTurbo": { cc: 3982, w: 205 },
    "B16B": { cc: 1595, w: 135 }, "K20C1": { cc: 1996, w: 140 }, "F20C": { cc: 1997, w: 148 }
  };
  
  for (const v of vehicles) {
    if (addedCodes.has(v.stock_engine_code)) continue;
    addedCodes.add(v.stock_engine_code);
    
    // Custom Redlines
    let redline = 7000;
    if (v.stock_engine_code.includes("13B") || v.stock_engine_code.includes("F20C")) redline = 9000;
    else if (v.stock_engine_code.includes("S54") || v.stock_engine_code.includes("S65") || v.stock_engine_code.includes("S85")) redline = 8200;
    else if (v.stock_engine_code.includes("RB26") || v.stock_engine_code.includes("2JZ")) redline = 7500;
    
    // Generate normalized curves
    const rpmPoints = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000].filter(r => r <= redline + 1000);
    const powerCurve = rpmPoints.map(rpm => ({ rpm, hp: Math.round(v.stock_hp * (Math.min(rpm, redline) / redline)) }));
    const torqueCurve = rpmPoints.map(rpm => ({ rpm, nm: Math.round(v.stock_torque_nm * (1 - Math.abs(Math.min(rpm, redline) - (redline*0.6))/(redline*1.2))) }));
    
    const spec = engineSpecs[v.stock_engine_code] || { cc: v.stock_hp > 300 ? 3000 : 2000, w: 150 };

    engines.push({
      engine_code: v.stock_engine_code,
      origin_car: `${v.make} ${v.model}`,
      displacement_cc: spec.cc,
      cylinder_count: v.stock_engine_code.includes("13B") ? 2 : (v.stock_engine_code.includes("V8") || v.stock_engine_code.includes("S65") ? 8 : (v.stock_engine_code.includes("2JZ") || v.stock_engine_code.includes("RB26") ? 6 : 4)),
      configuration: v.stock_engine_code.includes("13B") ? "rotary" : "inline",
      aspiration: v.stock_hp >= 250 && !v.stock_engine_code.includes("S54") && !v.stock_engine_code.includes("S65") ? "turbo" : "NA",
      stock_hp_at_rpm: `${v.stock_hp}hp`,
      stock_torque_nm_at_rpm: `${v.stock_torque_nm}Nm`,
      redline_rpm: redline,
      idle_rpm: 800,
      engine_weight_kg: spec.w,
      engine_width_mm: 600,
      engine_length_mm: v.stock_engine_code.includes("V8") || v.stock_engine_code.includes("S65") ? 700 : (v.stock_engine_code.includes("2JZ") || v.stock_engine_code.includes("RB26") ? 800 : 500),
      engine_height_mm: 600,
      orientation: v.drivetrain_stock === "FWD" ? "transverse" : "longitudinal",
      fuel_type_required: "95",
      power_curve_rpm_points: powerCurve,
      torque_curve_rpm_points: torqueCurve,
      compression_ratio: "10.0:1",
      max_boost_bar: v.stock_hp > 250 ? 1.2 : 0,
      intercooler_type: v.stock_hp > 250 ? "Front mount" : "Yok",
      cooling_type: "Su soğutmalı",
      oil_type_recommended: "5W-40",
      notes: "Gerçekçi verilerle donatılmış motor profili.",
      is_forged: false,
      max_hp_potential: Math.round(v.stock_hp * (v.stock_hp > 300 ? 1.8 : 2.1)),
      engine_inertia_kgm2: parseFloat((0.12 + spec.cc / 25000).toFixed(3)),
      flywheel_type: "standard",
      fuel_type: v.stock_hp > 300 ? "98" : "95",
      turbo_lag_rpm: (v.stock_hp >= 250 && !v.stock_engine_code.includes("S54") && !v.stock_engine_code.includes("S65") && !v.stock_engine_code.includes("FA20")) ? 1800 : 0,
      boost_threshold_rpm: (v.stock_hp >= 250 && !v.stock_engine_code.includes("S54") && !v.stock_engine_code.includes("S65") && !v.stock_engine_code.includes("FA20")) ? 3200 : 0,
      block_material: spec.cc > 3500 || v.stock_engine_code.includes("S65") || v.stock_engine_code.includes("S85") ? "aluminum" : "cast_iron",
      displacement_liters: parseFloat((spec.cc / 1000).toFixed(2)),
      power_per_liter: Math.round(v.stock_hp / (spec.cc / 1000)),
      volumetric_efficiency: 0.85,
      oil_cooling: v.stock_hp > 350,
      torque_at_launch_rpm_nm: Math.round(v.stock_torque_nm * 0.75)
    });
  }
  return engines;
}

const enginesDB = generateEngineDB(allVehicles);
fs.writeFileSync(path.join(__dirname, 'engines.json'), JSON.stringify(enginesDB, null, 2));

function generateTransDB(vehicles) {
  const transmissions = [];
  const addedCodes = new Set();
  
  for (const v of vehicles) {
    let tCode = v.stock_transmission;
    
    // Rename generics to famous ones
    if (tCode === "8-speed Auto") tCode = "ZF 8HP";
    else if (tCode === "6-speed DSG") tCode = "VW DQ250";
    else if (tCode === "7-speed S-Tronic") tCode = "Audi DQ500";
    else if (tCode === "6-speed DCT") tCode = "Getrag M-DCT";
    else if (tCode === "6-speed SST") tCode = "Getrag TC-SST";
    
    if (addedCodes.has(tCode)) continue;
    addedCodes.add(tCode);
    
    const isAuto = tCode.includes('Auto') || tCode.includes('ZF') || tCode.includes('DCT') || tCode.includes('DSG') || tCode.includes('S-Tronic') || tCode.includes('SST');
    const isManual = !isAuto;
    
    transmissions.push({
      transmission_code: tCode,
      origin_car: `${v.make} ${v.model}`,
      type: isAuto ? "DCT/Auto" : "Manuel",
      gear_count: parseInt(tCode.split('-')[0]) || (tCode.includes("8HP") ? 8 : 6),
      gear_ratios: [3.5, 2.0, 1.4, 1.0, 0.8, 0.6, 0.5, 0.4].slice(0, parseInt(tCode.split('-')[0]) || (tCode.includes("8HP") ? 8 : 6)),
      final_drive_ratio: 3.5,
      max_torque_capacity_nm: isAuto ? v.stock_torque_nm * 2.0 : v.stock_torque_nm * 1.5, // Auto'lar genelde daha dayanıklı kodlandı
      shift_time_ms: isAuto ? (tCode.includes("8HP") ? 80 : 100) : 250,
      weight_kg: isAuto ? 85 : 65,
      efficiency_pct: isAuto ? 90 : 95,
      compatible_engine_codes: [v.stock_engine_code],
      notes: "Orijinal üretici şanzımanı."
    });
  }
  return transmissions;
}

const transDB = generateTransDB(allVehicles);
fs.writeFileSync(path.join(__dirname, 'transmissions.json'), JSON.stringify(transDB, null, 2));

console.log(`Generated ${allVehicles.length} vehicles, ${enginesDB.length} engines, and ${transDB.length} transmissions.`);
