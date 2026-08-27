/* =========================================================
 *  ⚙️  ตั้งค่าก่อนใช้งาน
 *  วาง Web App URL ที่ได้จากการ Deploy Apps Script (ลงท้าย /exec)
 *  ถ้าตั้ง SECRET_TOKEN ใน Code.gs ให้ใส่ค่าเดียวกันที่ TOKEN
 * ========================================================= */
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw7S9Nm7e97VehY74Pp36kE39KTyUHZ5-TvagJjfjzolUy1VYDRi0sXAtVKNZrDUCVe/exec', 
};

/* รายการอาชีพ (แก้ที่นี่ได้ — ควรตรงกับ OCCUPATIONS ใน Code.gs)
   จังหวัด/อำเภอ/ตำบล ใช้ข้อมูลจาก thai-geo.js (ตัวแปร GEO) */
const OCCUPATIONS = ['กล้วยหอมทอง', 'กุ้งก้ามกราม', 'ข้าวสังข์หยด', 'พริก', 'พลู', 'มะพร้าวน้ำหอม', 'อื่น ๆ'];

/** เรียงอาชีพตามตัวอักษรไทย โดยคง "อื่น ๆ" ไว้ท้ายสุด */
function sortOcc(list) {
  const other = list.filter(x => x === 'อื่น ๆ');
  const rest = list.filter(x => x !== 'อื่น ๆ').sort((a, b) => a.localeCompare(b, 'th'));
  return rest.concat(other);
}

let RECORDS = [];

// ==================== เติมตัวเลือก dropdown ====================
setOptions('province', Object.keys(GEO), '— เลือก —');
setOptions('amphoe', [], '— เลือก —');
setOptions('tambon', [], '— เลือก —');
fill('mainOcc', sortOcc(OCCUPATIONS));
fill('subOcc',  sortOcc(OCCUPATIONS));

/** ล้างแล้วสร้างตัวเลือกใหม่ พร้อม placeholder */
function setOptions(id, arr, placeholder) {
  const s = document.getElementById(id);
  s.innerHTML = '';
  const p = document.createElement('option');
  p.value = ''; p.textContent = placeholder; s.appendChild(p);
  arr.forEach(v => { const op = document.createElement('option'); op.value = v; op.textContent = v; s.appendChild(op); });
}

/** เติมตัวเลือกต่อท้าย (ใช้กับ select ที่มี placeholder ใน HTML แล้ว) */
function fill(id, arr) {
  const s = document.getElementById(id);
  arr.forEach(v => { const op = document.createElement('option'); op.value = v; op.textContent = v; s.appendChild(op); });
}

// จังหวัด → อำเภอ → ตำบล (อัตโนมัติ)
function onProvince() {
  const prov = document.getElementById('province').value;
  const amps = (prov && GEO[prov]) ? Object.keys(GEO[prov]) : [];
  setOptions('amphoe', amps, '— เลือก —');
  setOptions('tambon', [], '— เลือก —');
}

function onAmphoe() {
  const prov = document.getElementById('province').value;
  const amp = document.getElementById('amphoe').value;
  const tams = (prov && amp && GEO[prov] && GEO[prov][amp]) ? GEO[prov][amp] : [];
  setOptions('tambon', tams, '— เลือก —');
}

// ==================== ฟอร์ม ====================
function val(id) { return document.getElementById(id).value.trim(); }

function toggleOther(which) {
  const sel = document.getElementById(which + 'Occ').value;
  document.getElementById(which + 'Other-wrap').classList.toggle('hidden', sel !== 'อื่น ๆ');
}

/** รายได้ = ราคาต่อกิโล × ปริมาณ (เมื่อกรอกครบทั้งสองช่อง) */
function calcIncome(which) {
  const price = val(which + 'PricePerKg').replace(/,/g, '');
  const qty   = val(which + 'QtyKg').replace(/,/g, '');
  const auto  = document.getElementById(which + 'Auto');
  if (price !== '' && qty !== '' && !isNaN(price) && !isNaN(qty)) {
    document.getElementById(which + 'Income').value = Number(price) * Number(qty);
    if (auto) auto.textContent = '· คำนวณอัตโนมัติ';
  } else if (auto) {
    auto.textContent = '';
  }
}

function switchTab(t) {
  document.getElementById('tab-form').classList.toggle('active', t === 'form');
  document.getElementById('tab-data').classList.toggle('active', t === 'data');
  document.getElementById('page-form').classList.toggle('hidden', t !== 'form');
  document.getElementById('page-data').classList.toggle('hidden', t !== 'data');
  if (t === 'data') loadData();
}

function save() {
  const name = val('name');
  if (!name) { toast('กรุณากรอกชื่อ - สกุล', true); document.getElementById('name').focus(); return; }

  const mainOcc = val('mainOcc') === 'อื่น ๆ' ? (val('mainOther') || 'อื่น ๆ') : val('mainOcc');
  const subOcc  = val('subOcc')  === 'อื่น ๆ' ? (val('subOther')  || 'อื่น ๆ') : val('subOcc');

  const data = {
    token: CONFIG.TOKEN,
    name, houseNo: val('houseNo'), moo: val('moo'),
    province: val('province'), amphoe: val('amphoe'), tambon: val('tambon'), phone: val('phone'),
    mainOcc, mainPricePerKg: val('mainPricePerKg'), mainQtyKg: val('mainQtyKg'),
    mainIncome: val('mainIncome'), mainCost: val('mainCost'), targetIncome: val('targetIncome'),
    subOcc, subPricePerKg: val('subPricePerKg'), subQtyKg: val('subQtyKg'),
    subIncome: val('subIncome'), subCost: val('subCost'), actualIncome: val('actualIncome'),
    note: val('note')
  };

  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>กำลังบันทึก…';

  fetch(CONFIG.SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  })
    .then(r => r.json())
    .then(res => {
      btn.disabled = false; btn.textContent = '💾 บันทึกข้อมูล';
      if (res && res.ok) { toast('บันทึกสำเร็จ (ลำดับที่ ' + res.no + ')'); clearForm(); }
      else toast('เกิดข้อผิดพลาด: ' + (res && res.error || 'ไม่ทราบสาเหตุ'), true);
    })
    .catch(e => {
      btn.disabled = false; btn.textContent = '💾 บันทึกข้อมูล';
      toast('บันทึกไม่สำเร็จ: ' + e.message, true);
    });
}

function clearForm() {
  ['name','houseNo','moo','phone','mainOther','mainPricePerKg','mainQtyKg',
   'mainIncome','mainCost','targetIncome','subOther','subPricePerKg','subQtyKg','subIncome',
   'subCost','actualIncome','note']
    .forEach(id => document.getElementById(id).value = '');
  ['province','mainOcc','subOcc'].forEach(id => document.getElementById(id).value = '');
  onProvince(); // รีเซ็ต อำเภอ/ตำบล
  document.getElementById('mainAuto').textContent = '';
  document.getElementById('subAuto').textContent = '';
  toggleOther('main'); toggleOther('sub');
  document.getElementById('name').focus();
}

// ==================== สรุปข้อมูล + รายการ ====================
function loadData() {
  document.getElementById('byProvince').innerHTML = '<div class="empty">กำลังโหลด…</div>';
  document.getElementById('byOcc').innerHTML = '<div class="empty">กำลังโหลด…</div>';
  fetch(CONFIG.SCRIPT_URL + '?action=stats')
    .then(r => r.json())
    .then(renderStats)
    .catch(e => {
      document.getElementById('byProvince').innerHTML = '<div class="empty">โหลดไม่สำเร็จ: ' + e.message + '</div>';
      document.getElementById('byOcc').innerHTML = '';
    });

  const empty = document.getElementById('emptyMsg');
  empty.textContent = 'กำลังโหลด…'; empty.style.display = 'block';
  document.getElementById('tbody').innerHTML = '';
  fetch(CONFIG.SCRIPT_URL + '?action=list')
    .then(r => r.json())
    .then(recs => { RECORDS = recs || []; renderTable(); })
    .catch(e => { empty.textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + e.message; });
}

function renderStats(s) {
  document.getElementById('st-total').textContent  = (s.total || 0).toLocaleString();
  document.getElementById('st-prov').textContent   = Object.keys(s.byProvince || {}).length;
  document.getElementById('st-income').textContent = (s.sumMainIncome || 0).toLocaleString();
  document.getElementById('st-avg').textContent    = (s.avgMainIncome || 0).toLocaleString();
  renderBreakdown('byProvince', s.byProvince);
  renderBreakdown('byOcc', s.byMainOcc);
}

function renderBreakdown(elId, obj) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { el.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>'; return; }
  const max = Math.max.apply(null, entries.map(e => e[1]));
  entries.forEach(([key, count]) => {
    const pct = max ? Math.round(count / max * 100) : 0;
    const row = document.createElement('div'); row.className = 'brow';
    const label = document.createElement('span'); label.textContent = key;
    const bar = document.createElement('span'); bar.className = 'bar';
    const fill = document.createElement('i'); fill.style.width = pct + '%'; bar.appendChild(fill);
    const cnt = document.createElement('span'); cnt.className = 'c'; cnt.textContent = count.toLocaleString();
    row.appendChild(label); row.appendChild(bar); row.appendChild(cnt);
    el.appendChild(row);
  });
}

/** ตารางรายการ — ลำดับคอลัมน์ตรงกับหัวตารางและชีต (ไม่แสดง 'วันที่บันทึก') */
function renderTable() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const rows = RECORDS.filter(r => !q ||
    [r.name, r.tambon, r.amphoe, r.province, r.mainOcc, r.subOcc].join(' ').toLowerCase().includes(q));
  const tb = document.getElementById('tbody'); tb.innerHTML = '';
  const nf = v => (v === '' || v === null || v === undefined) ? '' : (isNaN(v) ? v : Number(v).toLocaleString());

  rows.forEach(r => {
    const tr = document.createElement('tr');
    [r.no, r.name, r.houseNo, r.moo, r.province, r.amphoe, r.tambon, r.phone,
     r.mainOcc, nf(r.mainPricePerKg), nf(r.mainQtyKg), nf(r.mainIncome), nf(r.mainCost), nf(r.targetIncome),
     r.subOcc, nf(r.subPricePerKg), nf(r.subQtyKg), nf(r.subIncome), nf(r.subCost), nf(r.actualIncome), r.note]
      .forEach(v => { const td = document.createElement('td'); td.textContent = (v === null || v === undefined) ? '' : v; tr.appendChild(td); });
    tb.appendChild(tr);
  });

  const empty = document.getElementById('emptyMsg');
  if (rows.length === 0) { empty.style.display = 'block'; empty.textContent = RECORDS.length ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูล'; }
  else empty.style.display = 'none';
}

// ==================== แจ้งเตือน ====================
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (isErr ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast' + (isErr ? ' error' : ''), 2800);
}
