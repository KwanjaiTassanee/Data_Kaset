# ระบบเก็บข้อมูลครัวเรือน (GitHub + Netlify + Google Sheet)

หน้าเว็บฟอร์มเป็น static site เผยแพร่บน **Netlify** (ผ่าน **GitHub**)
ส่วนฐานข้อมูลใช้ **Google Sheet** โดยเชื่อมผ่าน **Google Apps Script API**

```
   ผู้ใช้ ──▶ หน้าเว็บ (Netlify)  ──fetch──▶  Apps Script API  ──▶  Google Sheet
```

## โครงสร้างไฟล์
```
household-form/
├─ index.html              # หน้าฟอร์ม + หน้าดูข้อมูล
├─ style.css               # สไตล์
├─ app.js                  # ⚙️ ต้องแก้ SCRIPT_URL ตรงนี้
├─ netlify.toml            # ตั้งค่า Netlify
└─ google-apps-script/
   └─ Code.gs              # โค้ดฝั่งเซิร์ฟเวอร์ (วางใน Apps Script)
```

---

## ส่วนที่ 1 — ตั้งฐานข้อมูล (Google Apps Script)

1. สร้าง Google Sheet ใหม่ที่ https://sheets.google.com (ไม่ต้องทำหัวตาราง ระบบสร้างให้เอง)
2. เมนู **Extensions → Apps Script**
3. ลบโค้ดเดิม แล้ววางเนื้อหาทั้งหมดจาก `google-apps-script/Code.gs` → กดบันทึก 💾
4. คลิก **Deploy → New deployment** → เลือกชนิด **Web app**
   - **Execute as:** Me
   - **Who has access:** **Anyone** *(จำเป็น เพื่อให้หน้าเว็บเรียกได้)*
5. คลิก **Deploy** → อนุญาตสิทธิ์
   (ถ้าขึ้น "Google hasn't verified" → **Advanced → Go to… → Allow**)
6. คัดลอก **Web app URL** ที่ลงท้ายด้วย `/exec` เก็บไว้

> ทดสอบได้: เปิด URL นั้นในเบราว์เซอร์ ต้องเห็น `{"ok":true,"message":"API พร้อมใช้งาน"}`

---

## ส่วนที่ 2 — ใส่ URL ลงในโค้ดหน้าเว็บ

เปิดไฟล์ `app.js` แก้บรรทัดบนสุด:
```javascript
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfyc..../exec',  // ← วาง URL จากขั้นตอนที่ 6
  TOKEN: ''
};
```

---

## ส่วนที่ 3 — ขึ้น GitHub

**วิธีง่าย (ผ่านเว็บ):**
1. สร้าง repository ใหม่ที่ https://github.com/new (เช่นชื่อ `household-form`)
2. หน้า repo คลิก **Add file → Upload files** ลากไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไป → Commit

**หรือผ่านคำสั่ง (ในโฟลเดอร์ household-form):**
```bash
git init
git add .
git commit -m "ระบบเก็บข้อมูลครัวเรือน"
git branch -M main
git remote add origin https://github.com/<ชื่อคุณ>/household-form.git
git push -u origin main
```

---

## ส่วนที่ 4 — Deploy บน Netlify

1. เข้า https://app.netlify.com → **Add new site → Import an existing project**
2. เลือก **GitHub** แล้วเลือก repo `household-form`
3. ตั้งค่า build (เป็น static ไม่ต้อง build):
   - **Build command:** เว้นว่าง
   - **Publish directory:** `.`
4. คลิก **Deploy** → รอสักครู่จะได้ลิงก์ เช่น `https://your-site.netlify.app`

**ตั้งชื่อโดเมน / ใช้โดเมนเอง:**
- เปลี่ยนชื่อ subdomain: **Site settings → Domain management → Options → Edit site name**
- ใช้โดเมนของตัวเอง: **Domain management → Add a domain** แล้วตั้งค่า DNS ตามที่ Netlify แนะนำ

เสร็จแล้วเปิดลิงก์ Netlify เพื่อใช้งานและแชร์ให้ผู้อื่นกรอกได้เลย
ทุกครั้งที่ push โค้ดใหม่ขึ้น GitHub, Netlify จะอัปเดตหน้าเว็บให้อัตโนมัติ

---

## หมายเหตุ / แก้ปัญหา

- **บันทึกไม่ได้ / ขึ้น error เกี่ยวกับ CORS:** ตรวจว่า Apps Script ตั้ง **Who has access = Anyone** และใช้ URL `/exec` (ไม่ใช่ `/dev`)
- **แก้ตัวเลือกจังหวัด/อาชีพ:** แก้ `PROVINCES` / `OCCUPATIONS` ใน `Code.gs` แล้ว Deploy ใหม่ (Manage deployments → Edit → New version) — และแก้ `FALLBACK` ใน `app.js` ให้ตรงกัน
- **กันคนสุ่มยิงข้อมูล:** ตั้งค่า `SECRET_TOKEN` ใน `Code.gs` และ `TOKEN` ใน `app.js` ให้เป็นค่าเดียวกัน
- ข้อมูลทั้งหมดอยู่ในชีตชื่อ **"ข้อมูลครัวเรือน"** เปิด/แก้ไข/ดาวน์โหลดเป็น Excel ได้ตามปกติ
