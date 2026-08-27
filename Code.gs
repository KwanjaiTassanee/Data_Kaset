/**
 * ระบบเก็บข้อมูลครัวเรือน — API (Google Sheet เป็นฐานข้อมูล)
 * ใช้คู่กับหน้าเว็บ static ที่ deploy บน GitHub + Netlify
 * ==================================================================
 *  GET  ?action=list     → รายการข้อมูลทั้งหมด (JSON, ล่าสุดอยู่บน)
 *  GET  ?action=stats    → สถิติสรุป (JSON)
 *  GET  ?action=options  → ตัวเลือก dropdown (JSON)
 *  POST (body = JSON)     → บันทึก 1 ระเบียน
 *
 *  ลำดับคอลัมน์ตรงกับฟอร์ม: จังหวัด→อำเภอ→ตำบล และ อาชีพ→ราคา→ปริมาณ→รายได้
 *  รายได้ = ราคาขายต่อกิโล × ปริมาณที่ขาย (คำนวณอัตโนมัติ)
 * ==================================================================
 */

// ========================= การตั้งค่า =========================
const SHEET_NAME  = 'ข้อมูลครัวเรือน';
const PROVINCES   = ['สงขลา', 'พัทลุง'];
const OCCUPATIONS = ['กล้วยหอมทอง', 'กุ้งก้ามกราม', 'ข้าวสังข์หยด', 'พริก', 'พลู', 'มะพร้าวน้ำหอม', 'อื่น ๆ'];
const SECRET_TOKEN = '';   // '' = ไม่ตรวจ ; ถ้าตั้งต้องตรงกับ TOKEN ใน app.js
const VERSION = '2026-final-6';  // ใช้ตรวจว่า deploy โค้ดล่าสุดแล้วหรือยัง

const HEADERS = [
  'ลำดับที่', 'ชื่อ - สกุล', 'บ้านเลขที่', 'หมู่ที่', 'จังหวัด', 'อำเภอ', 'ตำบล', 'เบอร์โทร',
  'ระบุอาชีพหลัก', 'ราคาขายต่อกิโล-หลัก (บาท/กก.)', 'ปริมาณที่ขาย-หลัก (กก.)',
  'รายได้อาชีพหลัก (บาท:เดือน)', 'ต้นทุนอาชีพหลัก', 'รายได้เป้าหมายหลัก (บาท:เดือน)',
  'อาชีพเสริม', 'ราคาขายต่อกิโล-เสริม (บาท/กก.)', 'ปริมาณที่ขาย-เสริม (กก.)',
  'รายได้อาชีพเสริม (บาท:เดือน)', 'ต้นทุนอาชีพเสริม', 'รายได้จริง (บาท:เดือน)',
  'หมายเหตุ', 'วันที่บันทึก'
];

// ========================= จุดเข้า API =========================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'list')    return json_(getRecords());
  if (action === 'stats')   return json_(getStats());
  if (action === 'options') return json_(getOptions());
  return json_({ ok: true, message: 'API พร้อมใช้งาน', version: VERSION, columns: HEADERS.length });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SECRET_TOKEN && body.token !== SECRET_TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    return json_(saveRecord(body));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ========================= ตัวช่วย =========================
function getOptions() {
  return { provinces: PROVINCES, occupations: OCCUPATIONS };
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  ensureHeaders_(sh);
  return sh;
}

/** เขียน/ซ่อมแถวหัวตารางให้ตรงกับ HEADERS เสมอ (ล้างหัวเก่าที่ค้างก่อน) */
function ensureHeaders_(sh) {
  const current = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  let match = true;
  for (let i = 0; i < HEADERS.length; i++) {
    if (String(current[i] || '') !== HEADERS[i]) { match = false; break; }
  }
  if (!match) {
    // ล้างหัวเดิมทั้งแถวก่อน กันหัวเก่าค้าง เช่น 'วันที่บันทึก' ซ้ำในคอลัมน์เกิน
    sh.getRange(1, 1, 1, sh.getMaxColumns()).clearContent();
    sh.getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS]).setFontWeight('bold').setBackground('#1f6f54').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? v : n;
}

/** รายได้ = ราคา × ปริมาณ (ถ้ากรอกครบ) ไม่งั้นใช้ค่าที่ส่งมา */
function calcIncome_(price, qty, fallback) {
  const hasP = price !== '' && price !== null && price !== undefined;
  const hasQ = qty   !== '' && qty   !== null && qty   !== undefined;
  const p = Number(String(price).replace(/,/g, '').trim());
  const q = Number(String(qty).replace(/,/g, '').trim());
  if (hasP && hasQ && !isNaN(p) && !isNaN(q)) return p * q;
  return num_(fallback);
}

// ========================= อ่าน/เขียนข้อมูล =========================
function saveRecord(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_();
    const nextNo = sh.getLastRow();
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    const mainIncome = calcIncome_(d.mainPricePerKg, d.mainQtyKg, d.mainIncome);
    const subIncome  = calcIncome_(d.subPricePerKg,  d.subQtyKg,  d.subIncome);

    const row = [
      nextNo, d.name || '', d.houseNo || '', d.moo || '',
      d.province || '', d.amphoe || '', d.tambon || '', d.phone || '',
      d.mainOcc || '', num_(d.mainPricePerKg), num_(d.mainQtyKg), mainIncome, num_(d.mainCost), num_(d.targetIncome),
      d.subOcc || '', num_(d.subPricePerKg), num_(d.subQtyKg), subIncome, num_(d.subCost), num_(d.actualIncome),
      d.note || '',
      now
    ];
    sh.appendRow(row);

    // บังคับรูปแบบเซลล์ของแถวที่เพิ่งบันทึกให้ถูกต้องเสมอ
    // (กันตัวเลขแสดงเป็นวันที่ เช่น รายได้/ปริมาณ และกัน 0 นำหน้าหายในเบอร์โทร)
    const wr = sh.getLastRow();
    const NUM = '#,##0.##';  // ตัวเลข (รองรับทศนิยม)
    const TXT = '@';         // ข้อความ
    const formats = [[
      NUM, // A ลำดับที่
      TXT, // B ชื่อ - สกุล
      TXT, // C บ้านเลขที่
      TXT, // D หมู่ที่
      TXT, // E จังหวัด
      TXT, // F อำเภอ
      TXT, // G ตำบล
      TXT, // H เบอร์โทร
      TXT, // I ระบุอาชีพหลัก
      NUM, // J ราคาขายต่อกิโล-หลัก
      NUM, // K ปริมาณที่ขาย-หลัก
      NUM, // L รายได้อาชีพหลัก
      NUM, // M ต้นทุนอาชีพหลัก
      NUM, // N รายได้เป้าหมายหลัก
      TXT, // O อาชีพเสริม
      NUM, // P ราคาขายต่อกิโล-เสริม
      NUM, // Q ปริมาณที่ขาย-เสริม
      NUM, // R รายได้อาชีพเสริม
      NUM, // S ต้นทุนอาชีพเสริม
      NUM, // T รายได้จริง
      TXT, // U หมายเหตุ
      TXT  // V วันที่บันทึก
    ]];
    sh.getRange(wr, 1, 1, HEADERS.length).setNumberFormats(formats);

    // คืนค่าคอลัมน์ข้อความที่อาจโดนตัด 0 นำหน้า (บ้านเลขที่/หมู่/เบอร์โทร)
    [3, 4, 8].forEach(function (col) {
      const v = row[col - 1];
      if (v !== '' && v !== null && v !== undefined) sh.getRange(wr, col).setValue(String(v));
    });

    return { ok: true, no: nextNo };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/** คืนรายการทั้งหมด (ไม่ส่งคอลัมน์ 'วันที่บันทึก' ออกหน้าเว็บ) */
function getRecords() {
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return values.map(r => ({
    no: r[0], name: r[1], houseNo: r[2], moo: r[3],
    province: r[4], amphoe: r[5], tambon: r[6], phone: r[7],
    mainOcc: r[8], mainPricePerKg: r[9], mainQtyKg: r[10], mainIncome: r[11], mainCost: r[12], targetIncome: r[13],
    subOcc: r[14], subPricePerKg: r[15], subQtyKg: r[16], subIncome: r[17], subCost: r[18], actualIncome: r[19],
    note: r[20]
  })).reverse();
}

function getStats() {
  const recs = getRecords();
  const byProvince = {};
  const byMainOcc = {};
  let sumMain = 0;
  recs.forEach(r => {
    if (r.province) byProvince[r.province] = (byProvince[r.province] || 0) + 1;
    if (r.mainOcc)  byMainOcc[r.mainOcc]  = (byMainOcc[r.mainOcc]  || 0) + 1;
    sumMain += Number(r.mainIncome) || 0;
  });
  const total = recs.length;
  return {
    total: total, byProvince: byProvince, byMainOcc: byMainOcc,
    sumMainIncome: sumMain, avgMainIncome: total ? Math.round(sumMain / total) : 0
  };
}

// ========================= ยูทิลิตี้ =========================
/** เตรียม/ซ่อมหัวตารางให้ตรงโครงสร้างล่าสุด (ไม่ลบข้อมูล) */
function setup() { getSheet_(); fixFormats(); }
function fixHeaders() { getSheet_(); }

/** ซ่อมรูปแบบเซลล์ของข้อมูลเดิมทั้งหมด (ตัวเลขที่แสดงเป็นวันที่จะกลับเป็นตัวเลข) */
function fixFormats() {
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return;
  const NUM = '#,##0.##', TXT = '@';
  const pattern = [NUM, TXT, TXT, TXT, TXT, TXT, TXT, TXT, TXT, NUM, NUM, NUM, NUM, NUM, TXT, NUM, NUM, NUM, NUM, NUM, TXT, TXT];
  const n = last - 1;
  const fmts = [];
  for (let i = 0; i < n; i++) fmts.push(pattern.slice());
  sh.getRange(2, 1, n, HEADERS.length).setNumberFormats(fmts);
}

/** ⚠️ ล้างข้อมูลทั้งหมดแล้วสร้างหัวตารางใหม่ (เริ่มเก็บใหม่หมด) */
function resetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (sh) {
    sh.clear();
    // ลบคอลัมน์ส่วนเกิน กันคอลัมน์เก่าค้าง (เช่น วันที่บันทึกซ้ำ)
    const extra = sh.getMaxColumns() - HEADERS.length;
    if (extra > 0) sh.deleteColumns(HEADERS.length + 1, extra);
  }
  getSheet_();
}
