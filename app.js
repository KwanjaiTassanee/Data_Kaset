/* =========================================================
 *  ⚙️  ตั้งค่าตรงนี้ (แก้ก่อนใช้งาน)
 *  วาง Web App URL ที่ได้จากการ Deploy Apps Script (ลงท้ายด้วย /exec)
 *  ถ้าตั้ง SECRET_TOKEN ใน Code.gs ให้ใส่ค่าเดียวกันที่ TOKEN
 * ========================================================= */
const CONFIG = {
  SCRIPT_URL: 'วาง_WEB_APP_URL_ตรงนี้',   // เช่น https://script.google.com/macros/s/AKfyc.../exec
  TOKEN: ''
};

/* ตัวเลือกสำรอง (ใช้เมื่อดึงจาก API ไม่ได้) — ควรตรงกับ Code.gs */
const FALLBACK = {
  provinces: ['สงขลา', 'พัทลุง'],
  occupations: ['ข้าวสังข์หยด', 'กล้วยหอมทอง', 'กุ้งก้ามกราม', 'พริก', 'มะพร้าวน้ำหอม', 'พลู', 'อื่น ๆ']
};

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

/** คำนวณรายได้ = ราคาต่อกิโล × ปริมาณ (เมื่อกรอกครบทั้งสองช่อง) */
function calcIncome(which) {
  const price = val(which + 'PricePerKg').replace(/,/g, '');
  const qty   = val(which + 'QtyKg').replace(/,/g, '');
  const auto  = document.getElementById(which + 'Auto');
  if (price !== '' && qty !== '' && !isNaN(price) && !isNaN(qty)) {
    const income = Number(price) * Number(qty);
    document.getElementById(which + 'Income').value = income;
    if (auto) auto.textContent = '· คำนวณอัตโนมัติ';
  } else {
    if (auto) auto.textContent = '';
  }
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
    mainOcc, mainPricePerKg: val('mainPricePerKg'), mainQtyKg: val('mainQtyKg'),
    mainIncome: val('mainIncome'), mainCost: val('mainCost'), targetIncome: val('targetIncome'),
    subOcc, subPricePerKg: val('subPricePerKg'), subQtyKg: val('subQtyKg'),
    subIncome: val('subIncome'), subCost: val('subCost'), actualIncome: val('actualIncome')
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
  ['name','houseNo','moo','tambon','amphoe','phone','mainOther','mainPricePerKg','mainQtyKg',
   'mainIncome','mainCost','targetIncome','subOther','subPricePerKg','subQtyKg','subIncome',
   'subCost','actualIncome']
    .forEach(id => document.getElementById(id).value = '');
  ['province','mainOcc','subOcc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mainAuto').textContent = '';
  document.getElementById('subAuto').textContent = '';
  toggleOther('main'); toggleOther('sub');
  document.getElementById('name').focus();
}

// ---------- สรุปข้อมูล (ไม่แสดงรายการรายบุคคลบนหน้าเว็บ) ----------
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
  entries.forEach(([key, val]) => {
    const pct = max ? Math.round(val / max * 100) : 0;
    const row = document.createElement('div'); row.className = 'brow';
    const label = document.createElement('span'); label.textContent = key;
    const bar = document.createElement('span'); bar.className = 'bar';
    const fill = document.createElement('i'); fill.style.width = pct + '%'; bar.appendChild(fill);
    const cnt = document.createElement('span'); cnt.className = 'c'; cnt.textContent = val.toLocaleString();
    row.appendChild(label); row.appendChild(bar); row.appendChild(cnt);
    el.appendChild(row);
  });
}

// ---------- แจ้งเตือน ----------
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (isErr ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast' + (isErr ? ' error' : ''), 2800);
}
