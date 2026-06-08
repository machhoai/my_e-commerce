# Cơ chế Mapping thủ công: Cửa hàng (E-Com) <-> Kho (WMS)

Bạn phân tích rất chính xác. ID của cửa hàng trên E-Commerce (`storeId`) và ID của kho trên WMS (`warehouse_id`) là hai hệ thống độc lập nên không thể gán ngầm tự động 1:1 được. Chúng ta cần một cơ chế mapping thủ công, thiết lập 1 lần ở màn hình Admin.

## Kế hoạch triển khai (Implementation Plan)

### 1. Cập nhật Type Definitions (`types/index.ts`)
- Thêm trường `wmsWarehouseId?: string;` vào interface `StoreDoc` (Cửa hàng) và `WarehouseDoc` (Kho tổng nội bộ). Trường này lưu ID của kho bên WMS tương ứng.

### 2. Backend WMS (BE-WMS)
- **[NEW] `GET /api/external/v1/warehouses`**: Tạo API trả về danh sách các Kho hợp lệ (`allowed_warehouse_ids`) mà Integration Client (E-Commerce) được phép truy cập.

### 3. Giao diện Admin E-Commerce (Mapping)
- **[MODIFY] `app/desktop/(dashboard)/admin/stores/page.tsx`**:
  - Khi mở Modal "Thêm/Sửa Cửa Hàng", gọi Server Action lấy danh sách Kho từ WMS.
  - Bổ sung một trường Dropdown (Select) có tên **"Liên kết kho WMS"**. Admin sẽ chọn kho WMS tương ứng cho cửa hàng này để gán giá trị vào `wmsWarehouseId`.

### 4. Logic Quét mã & Server Actions
- **[MODIFY] `actions/scanner.ts - preloadScannerData()`**:
  - Không dựa vào `.env` nữa. Hàm này sẽ lấy thông tin user hiện tại:
    - Nếu làm ở cửa hàng (`STORE`): Truy vấn `StoreDoc` để lấy `wmsWarehouseId`.
    - Nếu làm ở kho tổng (`CENTRAL`): Truy vấn `WarehouseDoc` để lấy `wmsWarehouseId`.
  - Nếu không có `wmsWarehouseId` (chưa mapping): Trả về thông báo lỗi "Cơ sở này chưa được liên kết với kho WMS".
  - Nếu có: Lấy đúng danh sách sản phẩm của kho đó từ WMS và trả dữ liệu về kèm theo `wmsWarehouseId`.
  - Bổ sung hàm `getWmsLocationsAction(warehouseId)` để lấy danh sách Vị trí (Shelf/Location).

### 5. Giao diện Scanner (`UniversalScannerModal.tsx` & `ScanQueueView.tsx`)
- Khi nhân viên mở Scanner, hệ thống sẽ tự động gọi `preloadScannerData()`. Hệ thống ngầm mapping và trả về dữ liệu đúng kho mà nhân viên đang làm việc (Nhân viên KHÔNG CẦN CHỌN KHO).
- Khi nhân viên bấm "Thêm vào hàng đợi" hoặc "Chốt gửi phiếu", nếu Kho có nhiều Vị trí (Locations), họ chỉ cần **chọn Vị trí (Location)** để đẩy lên WMS.

## Lợi ích của luồng này:
1. **Linh hoạt tuyệt đối:** Bạn có thể link bất kì Cửa hàng nào với bất kì Kho WMS nào qua trang Admin.
2. **Không gây lỗi người dùng:** Nhân viên cấp dưới hoàn toàn không biết đến khái niệm "Kho WMS", hệ thống tự động map ẩn bên dưới. Họ chỉ thấy sản phẩm và các kệ hàng (location) thuộc về nơi làm việc của họ.

Bạn có đồng ý với kiến trúc Mapping này không? Nếu đồng ý, tôi sẽ tiến hành update `types/index.ts`, BE-WMS và trang Admin Stores ngay lập tức.
