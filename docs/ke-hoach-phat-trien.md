# Kế hoạch phát triển

Nguồn yêu cầu: `Sáng kiến KPI.docx` - "Hệ thống quản lý, điều hành và đánh giá kết quả thực hiện nhiệm vụ trên mạng nội bộ". Số mục (§) dưới đây là số mục trong tài liệu đó.

Quy mô: 1 Ban, 5–20 người dùng, web app chạy trên máy chủ nội bộ qua LAN (§10, §11). Mở rộng về sau: Ban → Phòng → đơn vị trực thuộc, mỗi cấp chỉ xem dữ liệu của mình (§14).

## Bản đồ phân hệ

| # | Phân hệ (§4) | Giai đoạn |
|---|---|---|
| 1 | Quản lý người dùng | 0 (đã có khung) |
| 2 | Quản lý nhiệm vụ | 1 |
| 3 | Theo dõi tiến độ | 2 |
| 6 | Báo cáo kết quả, xác nhận | 2 |
| 5 | Cảnh báo, nhắc việc | 3 |
| 4 | Lịch nhiệm vụ | 4 |
| 7 | Thống kê, KPI | 5 |
| 8 | Dashboard chỉ huy + màn hình TV | 6 |
| - | Kế hoạch năm → quý → tháng → tuần, báo cáo định kỳ (§14) | 7 |
| - | Triển khai LAN, sao lưu (§10–12) | 8 |
| - | Trợ lý điều hành có AI (§15) | Không làm ở bản đầu |

Thứ tự theo phụ thuộc: mọi phân hệ đều đọc dữ liệu nhiệm vụ, nên nhiệm vụ làm trước; cảnh báo, lịch, KPI, dashboard chỉ là các cách nhìn khác nhau trên cùng dữ liệu đó.

Ước lượng tính theo ngày làm việc. Mỗi giai đoạn kết thúc bằng: build đạt, kiểm thử API, chạy thử trên trình duyệt, người dùng duyệt.

---

## Giai đoạn 0 - Nền tảng và phân quyền (≈2 ngày)

Đã có: đăng nhập, phiên, khoá đăng nhập sai, đổi mật khẩu, người dùng, đơn vị, vai trò, quyền, thông báo, tải tệp + xem trực tuyến, 4 vai trò `SUPER_ADMIN`, `HEAD`, `DEPUTY`, `ASSISTANT`.

Còn làm:
- [x] Bộ quyền nhiệm vụ `task.view / assign / self_report / review` gán cho Trưởng ban, Phó ban, trợ lý. (Quyền KPI làm ở giai đoạn 5.)
- [x] Phạm vi của Phó ban: trang Tổ chức › Phân công phụ trách - mỗi trợ lý một Phó ban phụ trách, hoặc Trưởng ban trực tiếp. Trưởng ban chỉnh trong Ban mình.
- [x] `SUPER_ADMIN` không xem nội dung nhiệm vụ (module nhiệm vụ chỉ mở cho Trưởng ban, Phó ban, trợ lý). Các module khác vẫn để guard bỏ qua cho vai trò này.
- [ ] Tạo quản trị đầu tiên từ `.env`, bỏ route đăng ký công khai.
- [ ] Tài khoản riêng cho màn hình TV, chỉ đọc (§9, §13).

## Giai đoạn 1 - Phân hệ 2: Quản lý nhiệm vụ (≈5 ngày)

Xương sống của hệ thống - các trường theo §5.

- [x] Mô hình nhiệm vụ: mã tự sinh theo đơn vị và năm (VD `TMKH-2026-001`), nội dung, người giao, chủ trì (1 người), phối hợp (nhiều người), căn cứ, loại (thường xuyên / đột xuất / trọng tâm), mức ưu tiên (bình thường / cao / rất cao), ngày giao, hạn hoàn thành, tiến độ, trạng thái, kết quả, đính kèm, ngày hoàn thành, người xác nhận, đánh giá.
- [x] Lịch sử thay đổi chỉ ghi thêm: ai, lúc nào, sửa trường gì, từ giá trị nào thành giá trị nào (§5, §13). Không ai xoá được lịch sử.
- [x] Không xoá nhiệm vụ - huỷ kèm lý do (người giao / Trưởng ban; người lập rút lại bản tự khai khi chưa ai duyệt).
- [x] Trưởng ban, Phó ban giao việc (Phó ban chỉ cho trợ lý mình phụ trách); trợ lý / Phó ban tự khai, duyệt 2 cấp, Trưởng ban chốt, trả lại 2 hướng (docs/xac-nhan-nghiep-vu.md).
- [x] Màn hình: danh sách theo tab (Của tôi / Tôi giao / Chờ tôi duyệt / Toàn Ban), tìm theo mã - nội dung - căn cứ, lọc trạng thái; giao / tự khai / sửa; chi tiết kèm dòng thời gian lịch sử.
- [ ] Lọc thêm theo loại, người, khoảng hạn.
- [ ] Trường "thuộc kế hoạch" - làm cùng giai đoạn 7.
- [x] Phân quyền xem: Trưởng ban tất cả, Phó ban trong phạm vi, trợ lý việc mình chủ trì hoặc phối hợp.

## Giai đoạn 2 - Phân hệ 3 + 6: Tiến độ, báo cáo kết quả, xác nhận (≈4 ngày)

- [x] Cập nhật tiến độ: nút nhanh 0 / 25 / 50 / 75 / 100% hoặc nhập trực tiếp, kèm nội dung đã làm (§4.3). Chỉ người xử lý chính (C4).
- [x] Chuyển tiếp xử lý: Phó ban chủ trì chuyển cho trợ lý mình phụ trách, chuyển người khác, thu hồi (C9).
- [x] Dòng thời gian có ý kiến kèm tệp; người phối hợp chỉ cho ý kiến (C4).
- [x] Báo cáo hoàn thành: kết quả, đính kèm văn bản / sản phẩm (dùng phân hệ tải tệp có sẵn).
- [x] Xác nhận 2 cấp (S8): Phó ban đề xuất mức đánh giá, Trưởng ban chốt; trả lại về Phó ban hoặc về người xử lý chính.
- [x] Luồng trạng thái: Đang thực hiện → Chờ xác nhận → Đã hoàn thành; trả lại thì quay về Đang thực hiện; Huỷ (§7).
- [x] Không ai tự xác nhận việc mình xử lý.
- [ ] Đề nghị gia hạn (C6).

## Giai đoạn 3 - Phân hệ 5: Cảnh báo, nhắc việc (≈3 ngày)

- [ ] Mức cảnh báo theo hạn (§7): còn 5 ngày, còn 2 ngày, đến hạn, quá hạn, chờ xác nhận, đã xác nhận - mỗi mức một màu, luôn kèm chữ.
- [ ] Ngưỡng ngày cấu hình được.
- [ ] Tác vụ định kỳ gửi thông báo (chuông, module có sẵn) cho chủ trì và người giao: sắp đến hạn, đến hạn, quá hạn, quá hạn mà chưa báo cáo kết quả. Không gửi trùng.

## Giai đoạn 4 - Phân hệ 4: Lịch nhiệm vụ (≈3 ngày)

- [ ] Xem theo ngày / tuần / tháng / quý / năm.
- [ ] Màu theo mức cảnh báo, bấm vào mở chi tiết nhiệm vụ.
- [ ] Lọc theo người, loại nhiệm vụ.

## Giai đoạn 5 - Phân hệ 7: Thống kê, KPI (≈4 ngày)

- [ ] Thống kê theo người và theo kỳ (§6): tổng được giao, hoàn thành, đang làm, đúng hạn, quá hạn, trọng tâm, đột xuất, tỷ lệ hoàn thành đúng hạn.
- [ ] Điểm KPI theo nhiệm vụ, tỷ trọng cấu hình được (mặc định: hoàn thành 40%, đúng hạn 25%, chất lượng 20%, trọng tâm / đột xuất 10%, cập nhật đầy đủ 5%).
- [ ] Chỉ Trưởng ban và người được phân quyền xem điểm. Có ghi chú: số liệu hỗ trợ, không tự quyết định thi đua, xếp loại (§6).
- [ ] Xuất Excel.

## Giai đoạn 6 - Phân hệ 8: Dashboard chỉ huy + màn hình TV (≈4 ngày)

- [ ] Dashboard Trưởng ban (§8): hôm nay có bao nhiêu việc đến hạn, sắp đến hạn, quá hạn, đang làm; bảng theo từng người; bấm người → nhiệm vụ của người đó; bấm nhiệm vụ → giao khi nào, ai chủ trì, tiến độ, lịch sử, sản phẩm, kết quả.
- [ ] Màn hình TV (§9): toàn màn hình, chữ to, tự xoay vòng 3 trang (nhiệm vụ tuần, tháng / quý, tiến độ nhiệm vụ trọng tâm), dòng chữ chạy phía dưới, tự cập nhật.
- [ ] TV không bao giờ nhận điểm KPI - chặn ở server; chỉ hiện việc được đánh dấu công khai.

## Giai đoạn 7 - Kế hoạch và báo cáo định kỳ (≈5 ngày)

"Xương sống" theo §14: nhiệm vụ cấp trên giao → kế hoạch của Ban → nhiệm vụ từng trợ lý → kết quả → báo cáo.

- [ ] Kế hoạch năm → quý → tháng → tuần; nhiệm vụ gắn vào kế hoạch.
- [ ] Ghi nhận nhiệm vụ cấp trên giao làm căn cứ.
- [ ] Tiến độ kế hoạch tự tính từ nhiệm vụ con.
- [ ] Báo cáo kết quả công tác tuần / tháng / quý / năm, kết quả từng cán bộ, nhiệm vụ tồn đọng, nhiệm vụ chuyển tiếp - xuất Word / Excel.

## Giai đoạn 8 - Triển khai LAN, sao lưu (≈2 ngày)

- [ ] HTTPS nội bộ (cookie đăng nhập đang bắt buộc HTTPS) hoặc cấu hình chạy HTTP cho LAN.
- [ ] Tên miền nội bộ kiểu `http://congviec-ban/` hoặc IP.
- [ ] Sao lưu tự động hằng ngày CSDL + tệp đính kèm sang NAS / ổ khác, có bản ngoại tuyến hằng tuần / tháng (§12); hướng dẫn khôi phục và chạy thử khôi phục.
- [ ] Tài liệu cài đặt, hướng dẫn sử dụng.

---

## Tổng ước lượng

Khoảng 36 ngày làm việc (≈7–8 tuần), chưa tính thời gian chờ duyệt và chỉnh sửa theo góp ý. Có thể dùng thử sau giai đoạn 3: lúc đó đã giao việc, theo dõi, xác nhận và nhắc việc được.

## Câu hỏi cần chốt trước từng giai đoạn

Trước giai đoạn 0–1:
1. Phạm vi Phó ban là danh sách trợ lý được phân công? Phó ban có được xác nhận hoàn thành trong phạm vi đó?
2. Việc trợ lý tự bổ sung có cần Trưởng / Phó ban duyệt mới được tính KPI?
3. Người phối hợp được làm gì: chỉ xem, hay thêm ghi chú / đính kèm?
4. Định dạng mã nhiệm vụ: `<mã đơn vị>-<năm>-<số thứ tự>`?

Trước giai đoạn 5:
5. Công thức KPI: tài liệu nêu hai cách khác nhau - nhân (trọng số × kết quả × tiến độ × thời hạn) và cộng theo tỷ trọng (40/25/20/10/5). Chọn cách nào?
6. Trợ lý có xem được số liệu / điểm của chính mình?

Trước giai đoạn 6:
7. TV hiện gì về từng người: tên chủ trì trên từng việc, hay bảng tổng theo người? (§2 và §9 nói khác nhau.)
