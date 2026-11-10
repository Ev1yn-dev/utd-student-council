# Security Policy · นโยบายความปลอดภัย

## Reporting a vulnerability · การรายงานช่องโหว่

กรุณา **อย่า** เปิด issue สาธารณะสำหรับปัญหาด้านความปลอดภัย
Please **do not** open a public issue for security problems.

รายงานแบบส่วนตัวผ่าน GitHub: แท็บ **Security → Report a vulnerability**
([private vulnerability reporting](https://github.com/Ev1yn-dev/utd-student-council/security/advisories/new))
แจ้งรายละเอียด: หน้า/ฟีเจอร์ที่เกี่ยวข้อง ขั้นตอนทำซ้ำ และผลกระทบที่คาดว่าจะเกิด
ทีมพัฒนาจะตอบกลับโดยเร็วและแจ้งเมื่อแก้ไขแล้ว ขอให้ไม่เปิดเผยรายละเอียดจนกว่าจะแก้ไขเสร็จ

## Supported versions

มีเพียงเวอร์ชันที่ deploy อยู่บน https://utdsc.com (branch `main`) ที่ได้รับการแก้ไขด้านความปลอดภัย

## Measures in place · มาตรการโดยรวม

- เข้าสู่ระบบด้วย Google เท่านั้น ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกคำขอ แยกบทบาทผู้ใช้ และบันทึก audit log
- Row Level Security บนฐานข้อมูลทุกตาราง เนื้อหาจากสภานักเรียนต้องผ่านการอนุมัติก่อนเผยแพร่
- ตรวจสอบข้อมูลนำเข้าฝั่งเซิร์ฟเวอร์ แสดงผลเนื้อหาเป็นข้อความธรรมดา ตรวจไฟล์อัปโหลดก่อนรับ
- Security headers (CSP, HSTS, frame-ancestors ฯลฯ) และการจำกัดอัตราคำขอ
- ค่าลับเก็บเฉพาะในระบบ hosting ไม่อยู่ใน repository; มี secret scan ทั้งตอน commit และใน CI
- อัปเดต dependency อัตโนมัติ (Dependabot) และตรวจ `npm audit` ใน CI
