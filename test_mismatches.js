import fs from 'fs';
const engines = JSON.parse(fs.readFileSync('./src/data/engines.json', 'utf-8'));
let mismatches = 0;
engines.forEach(e => {
    const maxHp = Math.max(...e.power_curve_rpm_points.map(p => p.hp));
    const maxNm = Math.max(...e.torque_curve_rpm_points.map(p => p.nm));
    
    const specHp = parseInt(e.stock_hp_at_rpm);
    const specNm = parseInt(e.stock_torque_nm_at_rpm);
    
    if (Math.abs(maxHp - specHp) > specHp * 0.1 || Math.abs(maxNm - specNm) > specNm * 0.1) {
        console.log(`${e.engine_code}: HP ${maxHp.toFixed(0)} vs ${specHp}, NM ${maxNm.toFixed(0)} vs ${specNm}`);
        mismatches++;
    }
});
console.log('Total mismatches:', mismatches);
