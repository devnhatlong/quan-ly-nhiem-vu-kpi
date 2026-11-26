/*
  Tạo dữ liệu TEST: đơn vị "Ban Tham mưu Kế hoạch" + 6 tài khoản trong đơn vị
  (1 Trưởng ban, 2 Phó ban, 3 Trợ lý).

  Cách chạy (đứng ở thư mục server):
    node scripts/seed-test-data.js

  Chạy lại nhiều lần vẫn an toàn: đơn vị / tài khoản đã có (theo mã, theo tên
  đăng nhập) thì bỏ qua, không ghi đè. Không chạy khi NODE_ENV=production -
  mọi tài khoản test dùng chung một mật khẩu ai cũng biết.
*/
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ROOT = path.resolve(__dirname, '..');

/** Mật khẩu chung của mọi tài khoản test. */
const TEST_PASSWORD = 'Test@2026';

const UNIT = { code: 'TMKH', name: 'Ban Tham mưu Kế hoạch' };

const USERS = [
  { username: 'truongban', fullName: 'Nguyễn Văn Hùng', position: 'Trưởng ban', rank: 'Thượng tá', role: 'HEAD' },
  { username: 'phoban1', fullName: 'Trần Quốc Tuấn', position: 'Phó ban', rank: 'Trung tá', role: 'DEPUTY' },
  { username: 'phoban2', fullName: 'Lê Thị Hạnh', position: 'Phó ban', rank: 'Trung tá', role: 'DEPUTY' },
  { username: 'troly1', fullName: 'Phạm Minh Đức', position: 'Trợ lý', rank: 'Thiếu tá', role: 'ASSISTANT' },
  { username: 'troly2', fullName: 'Hoàng Thu Trang', position: 'Trợ lý', rank: 'Đại úy', role: 'ASSISTANT' },
  { username: 'troly3', fullName: 'Vũ Đức Nam', position: 'Trợ lý', rank: 'Thượng úy', role: 'ASSISTANT' },
];

function readEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

/** Giống Helper.slugify bên server. */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const env = { ...readEnv(path.join(ROOT, '.env')), ...process.env };
  if (env.NODE_ENV === 'production') {
    throw new Error('Không tạo dữ liệu test trên môi trường production.');
  }

  const uri =
    `mongodb://${encodeURIComponent(env.DB_USERNAME)}:${encodeURIComponent(env.DB_PASSWORD)}` +
    `@${env.DB_HOST}:${env.DB_PORT || '27017'}/${env.DB_NAME}` +
    `?authSource=${encodeURIComponent(env.DB_AUTH_SOURCE)}`;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const now = new Date();

  // ---- đơn vị
  const departments = db.collection('departments');
  let unit = await departments.findOne({ code: UNIT.code });
  if (unit) {
    console.log(`Đơn vị ${UNIT.code} đã có - bỏ qua.`);
  } else {
    const { insertedId } = await departments.insertOne({
      code: UNIT.code,
      name: UNIT.name,
      slug: slugify(UNIT.name),
      parentId: null,
      ancestors: [],
      path: '/',
      depth: 0,
      sortOrder: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    unit = { _id: insertedId };
    console.log(`Đã tạo đơn vị ${UNIT.code} - ${UNIT.name}.`);
  }

  // ---- vai trò phải có sẵn (server tạo lúc khởi động)
  const roleCodes = new Set(
    (await db.collection('roles').find({}, { projection: { code: 1 } }).toArray()).map((r) => r.code),
  );
  const missing = [...new Set(USERS.map((u) => u.role))].filter((c) => !roleCodes.has(c));
  if (missing.length) {
    throw new Error(`Thiếu vai trò ${missing.join(', ')} - khởi động server một lần để tạo vai trò.`);
  }

  // ---- tài khoản
  const users = db.collection('users');
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  for (const item of USERS) {
    if (await users.findOne({ username: item.username })) {
      console.log(`Tài khoản ${item.username} đã có - bỏ qua.`);
      continue;
    }
    await users.insertOne({
      username: item.username,
      password: hash,
      fullName: item.fullName,
      position: item.position,
      rank: item.rank,
      departmentId: unit._id,
      roleAssignments: [{ roleCode: item.role, scopeDepartmentId: unit._id }],
      isActive: true,
      mustChangePassword: false,
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    console.log(`Đã tạo ${item.username} (${item.position} - ${item.fullName}).`);
  }

  console.log(`\nMật khẩu mọi tài khoản test: ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
