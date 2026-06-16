import fs from 'fs';
const engines = JSON.parse(fs.readFileSync('./src/data/engines.json', 'utf-8'));

engines.forEach(e => {
    const maxHp = Math.max(...e.power_curve_rpm_points.map(p => p.hp));
    const maxNm = Math.max(...e.torque_curve_rpm_points.map(p => p.nm));
    
    // basic sanity checks
    const specHp = parseInt(e.stock_hp_at_rpm);
    const specNm = parseInt(e.stock_torque_nm_at_rpm);
    
    if (Math.abs(maxHp - specHp) > specHp * 0.2) {
        console.log(`Engine ${e.engine_code}: Max HP curve (${maxHp.toFixed(1)}) mismatches spec (${specHp})`);
    }
    if (Math.abs(maxNm - specNm) > specNm * 0.2) {
        console.log(`Engine ${e.engine_code}: Max Nm curve (${maxNm.toFixed(1)}) mismatches spec (${specNm})`);
    }
});
