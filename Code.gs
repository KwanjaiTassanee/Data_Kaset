/**
 * ระบบเก็บข้อมูลครัวเรือน — API (Google Sheet เป็นฐานข้อมูล)
 * ใช้คู่กับหน้าเว็บ static ที่ deploy บน Netlify
 * ------------------------------------------------------------------
 *  doGet  ?action=list    → คืนข้อมูลทั้งหมด (JSON)
 *         ?action=stats   → คืนสถิติสรุป (JSON)
 *         ?action=options → คืนตัวเลือก dropdown (JSON)
 *  doPost (body = JSON)   → บันทึก 1 ระเบียนลงชีต
 */

// ====================== การตั้งค่า ======================
const SHEET_NAME  = 'ข้อมูลครัวเรือน';
const PROVINCES   = ['สงขลา', 'พัทลุง'];
const OCCUPATIONS = ['ข้าวสังข์หยด', 'กล้วยหอมทอง', 'กุ้งก้ามกราม', 'พริก', 'มะพร้าวน้ำหอม', 'อื่น ๆ'];

// (ทางเลือก) ตั้งรหัสลับกันคนสุ่มยิงข้อมูล ต้องตรงกับ TOKEN ใน app.js
// ปล่อยว่าง '' = ไม่ตรวจสอบ
const SECRET_TOKEN = '';

const HEADERS = [
  'ลำดับที่', 'ชื่อ - สกุล', 'บ้านเลขที่', 'หมู่ที่', 'ตำบล', 'อำเภอ', 'จังหวัด', 'เบอร์โทร',
  'ระบุอาชีพหลัก', 'รายได้อาชีพหลัก (บาท:เดือน)', 'ต้นทุนอาชีพหลัก', 'รายได้เป้าหมายหลัก (บาท:เดือน)',
  'อาชีพเสริม', 'รายได้อาชีพเสริม (บาท:เดือน)', 'ต้นทุนอาชีพเสริม', 'รายได้จริง (บาท:ปี)',
  'วันที่บันทึก'
];

// ====================== จุดเข้า API ======================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'list')    return json_(getRecords());
  if (action === 'stats')   return json_(getStats());
  if (action === 'options') return json_(getOptions());
  return json_({ ok: true, message: 'API พร้อมใช้งาน' });
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
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ====================== ตรรกะฐานข้อมูล ======================
function getOptions() {
  return { provinces: PROVINCES, occupations: OCCUPATIONS };
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#1f6f54')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? v : n;
}

function saveRecord(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_();
    const nextNo = sh.getLastRow(); // แถวหัว = 1 → ระเบียนแรกได้ลำดับ 1
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    const row = [
      nextNo, d.name || '', d.houseNo || '', d.moo || '', d.tambon || '', d.amphoe || '',
      d.province || '', d.phone || '',
      d.mainOcc || '', num_(d.mainIncome), num_(d.mainCost), num_(d.targetIncome),
      d.subOcc || '', num_(d.subIncome), num_(d.subCost), num_(d.actualIncome),
      now
    ];
    sh.appendRow(row);
    return { ok: true, no: nextNo };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function getRecords() {
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return values.map(r => ({
    no: r[0], name: r[1], houseNo: r[2], moo: r[3], tambon: r[4], amphoe: r[5],
    province: r[6], phone: r[7], mainOcc: r[8], mainIncome: r[9], mainCost: r[10],
    targetIncome: r[11], subOcc: r[12], subIncome: r[13], subCost: r[14],
    actualIncome: r[15], ts: r[16]
  })).reverse();
}

function getStats() {
  const recs = getRecords();
  const byProvince = {};
  let sumMain = 0;
  recs.forEach(r => {
    if (r.province) byProvince[r.province] = (byProvince[r.province] || 0) + 1;
    sumMain += Number(r.mainIncome) || 0;
  });
  return { total: recs.length, byProvince: byProvince, sumMainIncome: sumMain };
}

/** รันครั้งเดียวเพื่อเตรียมชีตล่วงหน้า (ไม่บังคับ) */
function setup() { getSheet_(); }
