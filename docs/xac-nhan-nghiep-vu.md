# Xác nhận nghiệp vụ với khách hàng

Ghi lại từng ý khách hàng đã chốt, để làm căn cứ khi lập trình. Ý nào chưa chốt thì để ở mục "Chờ xác nhận".

## Đã xác nhận

### Luồng giao nhiệm vụ (từ trên xuống) - xác nhận 2026-11-26

| # | Nội dung | Khách hàng trả lời |
|---|---|---|
| G1 | Trưởng ban tạo nhiệm vụ: 01 người chủ trì, người phối hợp (nếu có), nội dung, căn cứ, loại (thường xuyên / đột xuất / trọng tâm), mức độ ưu tiên, hạn hoàn thành | Đồng ý |
| G2 | Trưởng ban giao cho Phó ban thôi, hay giao thẳng xuống trợ lý được? | **Trưởng ban giao thẳng cho trợ lý được**, không bắt buộc qua Phó ban |
| G3 | Ai có thể làm chủ trì / phối hợp? | **Thường cả chủ trì lẫn phối hợp đều là trợ lý** - ô chọn người không giới hạn theo vai trò |
| G4 | Phó ban giao được cho trợ lý ngoài phạm vi phụ trách không? | **Không.** Phó ban chỉ giao cho trợ lý mình phụ trách |

Hệ quả khi lập trình:
- Trưởng ban: ô "Chủ trì" và "Phối hợp" chọn được mọi người trong Ban (Phó ban, trợ lý), Phó ban xếp trước (người dùng yêu cầu 2026-11-26).
- Phó ban: ô "Chủ trì" và "Phối hợp" chỉ có các trợ lý trong bảng Phân công phụ trách của mình. Server chặn cả khi gọi thẳng API.
- Trưởng ban giao thẳng cho trợ lý thì Phó ban phụ trách trợ lý đó vẫn **xem được** nhiệm vụ.

### Luồng gửi nhiệm vụ (từ dưới lên) - xác nhận 2026-11-26

| # | Nội dung | Khách hàng trả lời |
|---|---|---|
| S1 | Trợ lý tự khai nhiệm vụ phát sinh hoặc việc đã làm, kèm kết quả và tài liệu | Đồng ý |
| S2 | Gửi lên Phó ban phụ trách; trợ lý chưa có Phó ban phụ trách thì gửi thẳng Trưởng ban; Phó ban tự khai thì gửi Trưởng ban | Đồng ý |
| S3 | Cấp trên duyệt hoặc trả lại kèm lý do; khi duyệt, cấp trên xác định loại nhiệm vụ và mức độ | Đồng ý |
| S4 | Nhiệm vụ tự khai chỉ tính vào thống kê, KPI sau khi được duyệt | Đồng ý |
| S5 | 01 cấp hay 02 cấp duyệt? | **Luôn 02 cấp: Phó ban duyệt, rồi Trưởng ban duyệt mới là chốt** |
| S6 | Trưởng ban xem, sửa / trả lại bản Phó ban đã duyệt? | Đồng ý |

Luồng tự khai sau khi chốt:

```
Trợ lý có Phó ban phụ trách:  Trợ lý → Phó ban duyệt → Trưởng ban duyệt (chốt)
Trợ lý trực thuộc Trưởng ban: Trợ lý → Trưởng ban duyệt (chốt)
Phó ban tự khai:              Phó ban → Trưởng ban duyệt (chốt)
```

Hệ quả khi lập trình:
- Người nhận bản tự khai lấy từ bảng Phân công phụ trách tại **thời điểm gửi**. Đổi phân công sau khi gửi thì bản đang chờ duyệt vẫn ở người nhận cũ.
- Trợ lý không tự đặt loại nhiệm vụ và mức độ. **Phó ban đề xuất** khi duyệt bước 1; **Trưởng ban giữ nguyên hoặc sửa** khi chốt (S6).
- **Chỉ tính thống kê, KPI sau khi Trưởng ban chốt** (S4 + S5). Bản mới qua Phó ban thì chưa tính.
- Trả lại ở bước nào cũng bắt buộc có lý do. Bị trả lại thì trợ lý sửa và gửi lại từ đầu.

### Luồng cập nhật và hoàn thành - xác nhận 2026-11-26

| # | Nội dung | Khách hàng trả lời |
|---|---|---|
| C1 | Người chủ trì cập nhật tiến độ (bấm nhanh 0 / 25 / 50 / 75 / 100% hoặc nhập số %), ghi nội dung đã làm, đính kèm | Đồng ý |
| C2 | Báo cáo hoàn thành → Chờ xác nhận → xác nhận + đánh giá, hoặc trả lại kèm lý do | Đồng ý |
| C2a | Mức đánh giá | **Hoàn thành xuất sắc / Hoàn thành tốt / Hoàn thành / Không hoàn thành** |
| C4 | Ai cập nhật tiến độ, ai cho ý kiến? | **Chỉ người xử lý chính ở luồng hiện tại cập nhật tiến độ và báo hoàn thành.** Người xử lý chính vừa cập nhật vừa cho ý kiến trên dòng thời gian; **người phối hợp chỉ cho ý kiến** |
| C9 | Chuyển tiếp xử lý | Trưởng ban giao Phó ban chủ trì: Phó ban tự cập nhật / báo hoàn thành, **hoặc chuyển tiếp cho trợ lý** - khi đó trợ lý là người xử lý chính, cập nhật tiến độ và báo hoàn thành |

Hệ quả C4, C9 khi lập trình (2026-11-26):
- Nhiệm vụ có thêm "người xử lý chính", mặc định là chủ trì. Chỉ người này có nút Cập nhật tiến độ và Báo cáo hoàn thành.
- Chủ trì là Phó ban mới chuyển tiếp được, và chỉ cho trợ lý trong bảng Phân công phụ trách của mình. Chuyển tiếp rồi thì Phó ban vẫn là chủ trì: xem, cho ý kiến, thu hồi về mình. Muốn đổi sang trợ lý khác thì **thu hồi trước rồi mới chuyển tiếp lại** (người dùng yêu cầu 2026-11-26). Trợ lý không chuyển tiếp tiếp được.
- Người xử lý cũ (bị chuyển / thu hồi) vẫn xem và cho ý kiến được, không cập nhật được nữa.
- Mọi người xem được nhiệm vụ đều cho ý kiến (kèm tệp) trên dòng thời gian - Trưởng ban, Phó ban phụ trách, chủ trì, phối hợp. Ý kiến báo chuông cho những người liên quan.
- Trưởng ban sửa đổi chủ trì thì quyền xử lý chính về chủ trì mới.
- **Người phối hợp có nút "Xong phần việc của tôi"** (người dùng yêu cầu 2026-11-26): chỉ đánh dấu phần việc của người đó (kèm kết quả, tệp nếu có), không đổi trạng thái nhiệm vụ. Bỏ đánh dấu được khi nhiệm vụ còn đang thực hiện. Người xử lý chính vẫn là người báo hoàn thành cả nhiệm vụ; báo được kể cả khi còn người phối hợp chưa xong (có cảnh báo).
- Báo hoàn thành đi theo đề xuất S8: việc đã chuyển tiếp → Phó ban chuyển tiếp xác nhận bước 1 → Trưởng ban chốt.

| S7 | Trưởng ban trả lại bản đã qua Phó ban thì trả về đâu? | **Trưởng ban chọn khi trả lại: về cấp trước (Phó ban) hoặc về ban đầu (người lập)** |

Hệ quả S7: nút "Trả lại" ở bước Trưởng ban có 2 lựa chọn, đều bắt buộc lý do. Trả về Phó ban thì Phó ban duyệt lại hoặc trả tiếp về người lập; trả về ban đầu thì người lập sửa và gửi lại qua đủ các bước. Ở bước Phó ban chỉ có một hướng trả lại: về người lập.

## Đề xuất của bên phát triển - CHƯA xác nhận với khách

Người dùng (bên phát triển) chưa có ý kiến khách hàng cho các ý dưới đây, nên lấy đề xuất làm mặc định để làm. Khách xác nhận hoặc đổi ý thì chuyển lên mục "Đã xác nhận".

| # | Đề xuất | Lý do |
|---|---|---|
| S8 / C5 | Xác nhận hoàn thành nhiệm vụ được giao **cũng 2 cấp như tự khai**, theo người chủ trì chứ không theo người giao: chủ trì là trợ lý có Phó ban phụ trách → Phó ban xác nhận + đề xuất mức đánh giá → Trưởng ban chốt. Chủ trì là trợ lý trực thuộc Trưởng ban hoặc là Phó ban → Trưởng ban chốt luôn. Trả lại theo cách của S7. | Khách đã nói "lúc nào cũng 2 cấp, Trưởng ban duyệt mới là chốt". Dùng một luồng duyệt cho cả việc tự khai lẫn việc được giao thì người dùng chỉ phải học một cách. |
| S9 | Khi tự khai, trợ lý chọn **"Đã hoàn thành"** (việc đã làm xong, kèm kết quả) hoặc **"Đang thực hiện"** (việc phát sinh chưa xong). Được chốt: loại 1 thành Đã hoàn thành luôn; loại 2 chuyển sang Đang thực hiện rồi đi tiếp như việc được giao. | S1 đã chốt cả hai trường hợp; một bản tự khai có kết quả đầy đủ không nên phải duyệt hai lần. |
| C3 | Nhiệm vụ chỉ đóng khi Trưởng ban chốt. Không ai tự xác nhận việc mình chủ trì. Chủ trì chỉ chọn được trợ lý hoặc Phó ban (Trưởng ban không làm chủ trì). | Tránh trường hợp Trưởng ban vừa làm vừa tự chốt. |
| C6 | Có **đề nghị gia hạn**: người chủ trì nêu hạn mới + lý do, **Trưởng ban duyệt** (1 cấp), Phó ban phụ trách xem được. Lưu cả hạn gốc; thống kê đếm số lần gia hạn. | Hạn do lãnh đạo đặt; gia hạn không đi 2 cấp để khỏi chậm, nhưng vẫn lưu dấu để đánh giá. |
| C7 | Nhắc: còn 5 ngày, còn 2 ngày, đến hạn → nhắc **người chủ trì**. Quá hạn, quá hạn chưa báo cáo → nhắc chủ trì **và** Phó ban phụ trách, Trưởng ban. Mỗi mốc nhắc một lần. Mốc ngày cấu hình được. | Nhắc lãnh đạo ngay từ mốc 5 ngày sẽ thành nhiễu. |
| C8 | Không ai xoá. **Huỷ kèm lý do:** người giao huỷ được việc mình giao; Trưởng ban huỷ được mọi việc; người lập rút lại được bản tự khai khi chưa ai duyệt. Việc đã hoàn thành không huỷ được. | Đủ để sửa sai mà không mất dấu vết. |
| K1 | Mã tự sinh `<mã Ban>-<năm>-<số thứ tự 3 chữ số>`, ví dụ `TMKH-2026-001`; số thứ tự đếm lại từ 001 mỗi năm. Bản tự khai nhận mã khi gửi đi lần đầu. | Theo ví dụ trong tài liệu sáng kiến. |
| K2 | Trạng thái: **Nháp** (chỉ người lập thấy) → **Chờ duyệt** (hiện kèm "Bước 1/2: chờ Phó ban" hoặc "Bước 2/2: chờ Trưởng ban") → **Đang thực hiện** → **Chờ xác nhận** (cũng hiện bước 1/2, 2/2) → **Đã hoàn thành**. Thêm: **Bị trả lại**, **Đã huỷ**, và ghi chú **Quá hạn** đi kèm trạng thái. | Ít trạng thái, phần bước hiện riêng nên dễ đọc. |

## Chờ xác nhận

### Phát sinh từ S5 (2 cấp duyệt)
- [ ] S8. Xác nhận hoàn thành nhiệm vụ được giao có 2 cấp không? (xem đề xuất ở trên)

- [ ] S9, C3, C6, C7, C8, K1, K2 - đang làm theo đề xuất ở trên, chờ khách xác nhận.
