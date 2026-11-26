import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import type {
  ImportDepartmentRow,
  ImportUserRow,
} from "@/features/organization/types";

const UNIT_HEADERS = [
  "code",
  "name",
  "parentCode",
  "sortOrder",
  "isActive",
] as const;
const USER_HEADERS = [
  "username",
  "fullName",
  "email",
  "phone",
  "position",
  "rank",
  "departmentCode",
  "roleCodes",
  "isActive",
] as const;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }
  if (
    typeof value === "object" &&
    "text" in value &&
    typeof value.text === "string"
  ) {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function parseBool(raw: string): boolean | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (["1", "true", "yes", "y", "có", "co", "hiển thị", "hien thi"].includes(v))
    return true;
  if (["0", "false", "no", "n", "không", "khong", "ẩn", "an"].includes(v))
    return false;
  return undefined;
}

function buildHeaderMap(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell, col) => {
    const key = cellText(cell.value).toLowerCase();
    if (key) headerMap.set(key, col);
  });
  return headerMap;
}

export async function downloadUnitsImportTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DonVi");

  ws.addRow([...UNIT_HEADERS]);
  ws.getRow(1).font = { bold: true };
  ws.addRow(["P01", "Phòng ...", "", 0, true]);
  ws.addRow(["TMKH", "Ban Tham mưu Kế hoạch", "P01", 1, true]);

  ws.columns = [
    { width: 14 }, // code
    { width: 36 }, // name
    { width: 14 }, // parentCode
    { width: 12 }, // sortOrder
    { width: 12 }, // isActive
  ]

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "mau-import-don-vi.xlsx",
  );
}

export async function parseUnitsExcel(
  file: File,
): Promise<ImportDepartmentRow[]> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel không có sheet nào.");

  const headerMap = buildHeaderMap(ws);
  const col = (name: string) => headerMap.get(name.toLowerCase());

  if (!col("code") || !col("name")) {
    throw new Error('File cần có cột "code" và "name" ở dòng đầu.');
  }

  const rows: ImportDepartmentRow[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const code = cellText(row.getCell(col("code")!).value);
    const name = cellText(row.getCell(col("name")!).value);
    if (!code && !name) return;

    const parentCode = col("parentcode")
      ? cellText(row.getCell(col("parentcode")!).value) || undefined
      : undefined;
    const sortRaw = col("sortorder")
      ? cellText(row.getCell(col("sortorder")!).value)
      : "";
    const activeRaw = col("isactive")
      ? cellText(row.getCell(col("isactive")!).value)
      : "";

    rows.push({
      code,
      name,
      parentCode,
      sortOrder: sortRaw ? Number(sortRaw) || 0 : undefined,
      isActive: parseBool(activeRaw),
    });
  });

  if (!rows.length) throw new Error("Không có dòng dữ liệu hợp lệ trong file.");
  return rows;
}

export async function downloadUsersImportTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("NguoiDung");

  ws.addRow([...USER_HEADERS]);
  ws.getRow(1).font = { bold: true };
  ws.addRow([
    "truongban",
    "Nguyễn Văn A",
    "truongban@noibo.local",
    "",
    "Trưởng ban",
    "Thượng tá",
    "TMKH",
    "HEAD",
    true,
  ]);
  ws.addRow([
    "phoban",
    "Trần Văn B",
    "phoban@noibo.local",
    "",
    "Phó ban",
    "Trung tá",
    "TMKH",
    "DEPUTY",
    true,
  ]);
  ws.addRow([
    "troly1",
    "Lê Văn C",
    "troly1@noibo.local",
    "",
    "Trợ lý",
    "Đại úy",
    "TMKH",
    "ASSISTANT",
    true,
  ]);

  // Đúng 9 ô, khớp từng cột của USER_HEADERS - thiếu một ô là mọi cột từ đó
  // trở đi ăn nhầm bề rộng của cột bên trái.
  ws.columns = [
    { width: 14 }, // username
    { width: 24 }, // fullName
    { width: 24 }, // email
    { width: 14 }, // phone
    { width: 18 }, // position
    { width: 14 }, // rank
    { width: 16 }, // departmentCode
    { width: 18 }, // roleCodes
    { width: 10 }, // isActive
  ];

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "mau-import-nguoi-dung.xlsx",
  );
}

export async function parseUsersExcel(file: File): Promise<ImportUserRow[]> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel không có sheet nào.");

  const headerMap = buildHeaderMap(ws);
  const col = (name: string) => headerMap.get(name.toLowerCase());

  if (!col("username")) {
    throw new Error('File cần có cột "username" ở dòng đầu.');
  }

  const rows: ImportUserRow[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const username = cellText(row.getCell(col("username")!).value);
    if (!username) return;

    rows.push({
      username,
      fullName: col("fullname")
        ? cellText(row.getCell(col("fullname")!).value) || undefined
        : undefined,
      email: col("email")
        ? cellText(row.getCell(col("email")!).value) || undefined
        : undefined,
      phone: col("phone")
        ? cellText(row.getCell(col("phone")!).value) || undefined
        : undefined,
      position: col("position")
        ? cellText(row.getCell(col("position")!).value) || undefined
        : undefined,
      rank: col("rank")
        ? cellText(row.getCell(col("rank")!).value) || undefined
        : undefined,
      departmentCode: col("departmentcode")
        ? cellText(row.getCell(col("departmentcode")!).value) || undefined
        : undefined,
      roleCodes: col("rolecodes")
        ? cellText(row.getCell(col("rolecodes")!).value) || undefined
        : undefined,
      isActive: col("isactive")
        ? parseBool(cellText(row.getCell(col("isactive")!).value))
        : undefined,
    });
  });

  if (!rows.length) throw new Error("Không có dòng dữ liệu hợp lệ trong file.");
  return rows;
}
