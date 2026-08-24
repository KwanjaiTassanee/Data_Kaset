/* =========================================================
 *  ⚙️  ตั้งค่าตรงนี้ (แก้ก่อนใช้งาน)
 *  วาง Web App URL ที่ได้จากการ Deploy Apps Script (ลงท้ายด้วย /exec)
 *  ถ้าตั้ง SECRET_TOKEN ใน Code.gs ให้ใส่ค่าเดียวกันที่ TOKEN
 * ========================================================= */
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbySYZE4mLS3FWN50jSAVxGry5e9-_vYz_nH5H4Mb1rZDvgCr7oCCrCIs9BkFcDKJdiR/exec',   // เช่น https://script.google.com/macros/s/AKfyc.../exec
  TOKEN: ''
};

/* ตัวเลือกสำรอง (ใช้เมื่อดึงจาก API ไม่ได้) — ควรตรงกับ Code.gs */
const FALLBACK = {
  provinces: ['สงขลา', 'พัทลุง'],
  occupations: ['ข้าวสังข์หยด', 'กล้วยหอมทอง', 'กุ้งก้ามกราม', 'พริก', 'มะพร้าวน้ำหอม', 'อื่น ๆ']
};

let RECORDS = [];

// ---------- โหลดตัวเลือก dropdown ----------
fetch(CONFIG.SCRIPT_URL + '?action=options')
  .then(r => r.json())
  .then(o => initOptions(o))
  .catch(() => initOptions(FALLBACK));

function initOptions(o) {
  fill('province', o.provinces || FALLBACK.provinces);
  fill('mainOcc', o.occupations || FALLBACK.occupations);
  fill('subOcc', o.occupations || FALLBACK.occupations);
}

function fill(id, arr) {
  const s = document.getElementById(id);
  arr.forEach(v => {
    const op = document.createElement('option');
    op.value = v; op.textContent = v; s.appendChild(op);
  });
}

function toggleOther(which) {
  const sel = document.getElementById(which + 'Occ').value;
  document.getElementById(which + 'Other-wrap').classList.toggle('hidden', sel !== 'อื่น ๆ');
}

function switchTab(t) {
  document.getElementById('tab-form').classList.toggle('active', t === 'form');
  document.getElementById('tab-data').classList.toggle('active', t === 'data');
  document.getElementById('page-form').classList.toggle('hidden', t !== 'form');
  document.getElementById('page-data').classList.toggle('hidden', t !== 'data');
  if (t === 'data') loadData();
}

function val(id) { return document.getElementById(id).value.trim(); }

// ---------- บันทึกข้อมูล ----------
function save() {
  const name = val('name');
  if (!name) { toast('กรุณากรอกชื่อ - สกุล', true); document.getElementById('name').focus(); return; }
  const mainOcc = val('mainOcc') === 'อื่น ๆ' ? (val('mainOther') || 'อื่น ๆ') : val('mainOcc');
  const subOcc  = val('subOcc')  === 'อื่น ๆ' ? (val('subOther')  || 'อื่น ๆ') : val('subOcc');
  const data = {
    token: CONFIG.TOKEN,
    name, houseNo: val('houseNo'), moo: val('moo'), tambon: val('tambon'), amphoe: val('amphoe'),
    province: val('province'), phone: val('phone'),
    mainOcc, mainIncome: val('mainIncome'), mainCost: val('mainCost'), targetIncome: val('targetIncome'),
    subOcc, subIncome: val('subIncome'), subCost: val('subCost'), actualIncome: val('actualIncome')
  };

  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>กำลังบันทึก…';

  // ใช้ Content-Type text/plain เพื่อเลี่ยง CORS preflight ของ Apps Script
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
  ['name','houseNo','moo','tambon','amphoe','phone','mainOther','mainIncome','mainCost',
   'targetIncome','subOther','subIncome','subCost','actualIncome']
    .forEach(id => document.getElementById(id).value = '');
  ['province','mainOcc','subOcc'].forEach(id => document.getElementById(id).value = '');
  toggleOther('main'); toggleOther('sub');
  document.getElementById('name').focus();
}

// ---------- ดูข้อมูล ----------
function loadData() {
  const empty = document.getElementById('emptyMsg');
  empty.textContent = 'กำลังโหลด…'; empty.style.display = 'block';
  document.getElementById('tbody').innerHTML = '';

  fetch(CONFIG.SCRIPT_URL + '?action=list')
    .then(r => r.json())
    .then(recs => { RECORDS = recs || []; renderTable(); })
    .catch(e => { empty.textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + e.message; });

  fetch(CONFIG.SCRIPT_URL + '?action=stats')
    .then(r => r.json())
    .then(s => {
      document.getElementById('st-total').textContent = (s.total || 0).toLocaleString();
      document.getElementById('st-prov').textContent = Object.keys(s.byProvince || {}).length;
      document.getElementById('st-income').textContent = (s.sumMainIncome || 0).toLocaleString();
    })
    .catch(() => {});
}

function renderTable() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const rows = RECORDS.filter(r => !q ||
    [r.name, r.tambon, r.amphoe, r.province, r.mainOcc, r.subOcc].join(' ').toLowerCase().includes(q));
  const tb = document.getElementById('tbody'); tb.innerHTML = '';
  const nf = v => (v === '' || v === null || v === undefined) ? '' : (isNaN(v) ? v : Number(v).toLocaleString());

  rows.forEach(r => {
    const tr = document.createElement('tr');
    [r.no, r.name, r.houseNo, r.moo, r.tambon, r.amphoe, r.province, r.phone, r.mainOcc,
     nf(r.mainIncome), nf(r.mainCost), nf(r.targetIncome), r.subOcc, nf(r.subIncome),
     nf(r.subCost), nf(r.actualIncome), r.ts]
      .forEach(v => { const td = document.createElement('td'); td.textContent = (v === null || v === undefined) ? '' : v; tr.appendChild(td); });
    tb.appendChild(tr);
  });

  const empty = document.getElementById('emptyMsg');
  if (rows.length === 0) { empty.style.display = 'block'; empty.textContent = RECORDS.length ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูล'; }
  else empty.style.display = 'none';
}

// ---------- แจ้งเตือน ----------
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (isErr ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast' + (isErr ? ' error' : ''), 2800);
}
