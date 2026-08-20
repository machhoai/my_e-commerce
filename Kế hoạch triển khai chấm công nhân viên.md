## Kết luận

Không nên sao chép nguyên trạng JPULSE. Hướng phù hợp là xây một lớp chấm công thống nhất theo `storeId`, trong đó mỗi cửa hàng cấu hình:

1. Nguồn chấm công: `MACHINE` hoặc `SOFTWARE`.
2. Nếu là `SOFTWARE`, phương thức xác minh chỉ gồm `GPS` hoặc `IP`.
3. Dữ liệu từ cả hai nguồn được chuẩn hóa thành cùng một loại sự kiện để `/manager/hr/attendance` hiển thị và tính công thống nhất.

Trang quản lý hiện có khá đầy đủ về báo cáo, FILO, quy tắc ca và xuất Excel; nên giữ lại phần này và thay tầng dữ liệu bên dưới.

## Những gì JPULSE đang làm

JPULSE triển khai tương đối hoàn chỉnh:

- Chính sách chấm công theo từng cơ sở.
- Bật/tắt chấm công.
- Xác minh `IP_ONLY`, `GPS_ONLY`, `IP_OR_GPS`, `IP_AND_GPS`.
- GPS có bán kính, độ chính xác tối đa và tuổi dữ liệu tối đa.
- Lưu cả lần thành công và lần bị từ chối kèm lý do.
- Miễn chấm công cho một số nhân viên.
- Công tác, làm tại nhà và geofence riêng.
- Báo đến trễ.
- Lọc tuần/tháng, cơ sở, nhân viên và xuất dữ liệu.
- Phân quyền theo cơ sở.
- Chống ghi nhận check-in thành công hai lần trong ngày bằng transaction.

Các phần chính nằm tại:

- [attendance.ts](D:/Github/bduck-system/packages/shared-types/src/attendance.ts:20)
- [attendanceLocationPolicy.ts](D:/Github/bduck-system/apps/be-wms/src/services/attendanceLocationPolicy.ts:100)
- [attendanceService.ts](D:/Github/bduck-system/apps/be-wms/src/services/attendanceService.ts:175)
- [TimeAttendanceTab.tsx](D:/Github/bduck-system/apps/fe-wms/src/components/employee-admin/time-attendance/TimeAttendanceTab.tsx:180)
- [useAttendance.ts](D:/Github/bduck-system/apps/fe-wms/src/hooks/useAttendance.ts:56)

Điểm cần lưu ý: JPULSE hiện chỉ ghi nhận một lần `check-in` thành công mỗi ngày, không có `check-out`. Ngoài ra, JPULSE lưu check-in offline trong `localStorage` rồi gửi lại `action_time` từ client. Cách này không nên bê nguyên sang hệ thống tính giờ công vì có thể bị thay đổi thời gian phía client.

## Hiện trạng dự án này

Dự án hiện đã có:

- Đồng bộ raw punch từ ZKTeco.
- Mapping người dùng máy với tài khoản hệ thống.
- FILO: lần đầu là vào, lần cuối là ra.
- Tính giờ công, vào sớm/đúng giờ/trễ, về sớm/tăng ca.
- Xem ngày/tháng, raw punch và xuất Excel.
- Cấu hình thời gian theo ca/ngày thường/cuối tuần/ngày đặc biệt.

Tuy nhiên có những khoảng trống quan trọng:

- `attendance_logs` đang là schema riêng của ZKTeco, không có `storeId`, `source` hay thông tin xác minh.
- API chỉ xác minh token, chưa kiểm tra `page.hr.attendance`, quyền cấu hình hoặc phạm vi cửa hàng: [attendance API](D:/Github/my_e-commerce/app/api/hr/attendance/route.ts:19).
- Trang chỉ lấy nhân viên đã mapping với ZKTeco. Nhân viên chấm công phần mềm sẽ bị loại khỏi danh sách: [attendance page](<D:/Github/my_e-commerce/app/desktop/(dashboard)/manager/hr/attendance/page.tsx:388>).
- Quy tắc chấm công đang đọc và ghi vào `settings/global`, nên chưa thực sự độc lập theo cửa hàng: [attendance page](<D:/Github/my_e-commerce/app/desktop/(dashboard)/manager/hr/attendance/page.tsx:198>).
- Đồng bộ máy sử dụng khóa `${zk_user_id}_${epoch}` và không có `deviceId`; nếu có nhiều máy, ID nhân viên có thể trùng giữa các máy: [sync-attendance](D:/Github/my_e-commerce/app/api/hr/sync-attendance/route.ts:78).
- ZKTeco bridge hiện hard-code một thiết bị, chưa có mô hình máy → cửa hàng: [main.py](D:/Github/my_e-commerce/services/zkteco-bridge/main.py:21).
- `StoreDoc` chưa có tọa độ để kiểm tra geofence: [types/index.ts](D:/Github/my_e-commerce/types/index.ts:427).

## Kiến trúc đề xuất

### 1. Chính sách theo cửa hàng

Nên tạo `store_attendance_policies/{storeId}` thay vì tiếp tục dùng `settings/global`:

```ts
interface StoreAttendancePolicy {
  storeId: string;
  enabled: boolean;

  sourceMode: 'MACHINE' | 'SOFTWARE';
  verificationMethod: 'GPS' | 'IP' | null;

  allowedIpAddresses: string[];

  gps: {
    latitude: number;
    longitude: number;
    radiusM: number;
    maxAccuracyM: number;
    maxAgeSeconds: number;
  } | null;

  requireCheckOut: boolean;
  timezone: 'Asia/Ho_Chi_Minh';

  effectiveFrom: string;
  effectiveTo?: string | null;
  updatedBy: string;
  updatedAt: string;
}
```

Tách `sourceMode` và `verificationMethod` sẽ tránh nhầm lẫn:

- Cửa hàng dùng máy: `MACHINE`, không cần GPS/IP trên phần mềm.
- Cửa hàng không dùng máy: `SOFTWARE` + `GPS` hoặc `IP`.

Không cần đưa `IP_OR_GPS` và `IP_AND_GPS` của JPULSE vào phiên bản đầu vì yêu cầu hiện tại chỉ có hai lựa chọn.

### 2. Dữ liệu chấm công thống nhất

Nên tạo collection mới `attendance_events`, thay vì làm schema ZKTeco hiện tại phình thành nhiều trường optional:

```ts
interface AttendanceEvent {
  id: string;
  storeId: string;
  employeeUid: string;

  eventType: 'CHECK_IN' | 'CHECK_OUT';
  source: 'MACHINE' | 'SOFTWARE';
  method: 'BIOMETRIC' | 'GPS' | 'IP';

  occurredAt: Timestamp;       // Thời gian được server chấp nhận
  clientCapturedAt?: Timestamp;
  attendanceDate: string;      // Theo Asia/Ho_Chi_Minh

  status: 'ACCEPTED' | 'REJECTED';
  rejectedReason?: string;

  verification?: {
    ipAddress?: string;
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    distanceM?: number;
  };

  device?: {
    deviceId: string;
    zkUserId: string;
    zkUid?: number;
  };

  idempotencyKey: string;
  createdAt: Timestamp;
}
```

Giai đoạn chuyển tiếp:

- API đọc đồng thời `attendance_logs` cũ và `attendance_events`.
- Raw log ZKTeco được normalize thành event.
- Sau khi backfill hoàn tất, chuyển sync ZKTeco sang ghi trực tiếp `attendance_events`.
- Giữ raw device data riêng nếu vẫn cần đối soát kỹ thuật.

### 3. Check-in và check-out trên phần mềm

Khuyến nghị hỗ trợ cả hai thao tác:

- Chưa có `CHECK_IN` hợp lệ → nút “Chấm công vào”.
- Đã check-in nhưng chưa check-out → nút “Chấm công ra”.
- Đã đủ hai lần → hiển thị kết quả trong ngày.

Điều này phù hợp hơn JPULSE vì trang hiện tại đã tính `checkOut` và `workHours`. Nếu chỉ triển khai một check-in/ngày giống hệt JPULSE, cửa hàng dùng phần mềm sẽ không có giờ ra và tổng giờ làm.

API dự kiến:

```text
GET  /api/hr/attendance/context
POST /api/hr/attendance/punch
GET  /api/hr/attendance/me
GET  /api/hr/attendance?storeId=...&date=...
GET  /api/hr/attendance?storeId=...&month=...
GET  /api/hr/attendance/policies/:storeId
PUT  /api/hr/attendance/policies/:storeId
```

`POST /punch` phải dùng transaction để tránh double click hoặc hai request đồng thời.

### 4. Xác minh GPS/IP

GPS:

- Trình duyệt lấy vị trí với `enableHighAccuracy`.
- Server kiểm tra tọa độ, accuracy, thời điểm capture và khoảng cách Haversine.
- Không tin kết quả `distance` do client gửi.
- Geolocation yêu cầu HTTPS.
- Cần bổ sung tọa độ cho từng cửa hàng.

IP:

- So sánh public IP/NAT của cửa hàng, không phải IP LAN như `192.168.x.x`.
- Chỉ đọc IP từ header của proxy/CDN đáng tin cậy.
- Nên hỗ trợ IPv4, IPv6 và CIDR nếu hạ tầng cần.
- Không lấy trực tiếp mọi giá trị `x-forwarded-for` mà không xác định proxy tin cậy.

GPS trên trình duyệt vẫn có khả năng bị giả mạo; nó phù hợp làm kiểm soát vận hành, không phải bằng chứng chống gian lận tuyệt đối.

### 5. Điều chỉnh `/manager/hr/attendance`

Giữ lại UI báo cáo hiện tại nhưng thay đổi nguồn dữ liệu:

- Thêm chọn cửa hàng và bắt buộc gửi `storeId`.
- Danh sách nhân viên lấy theo cửa hàng/lịch phân ca, không lấy từ `mappedZkByUid`.
- Hiển thị nhân viên không có chấm công để quản lý nhận biết vắng mặt.
- Dùng ca đã được xếp trong `schedules` trước; chỉ auto-detect ca gần nhất khi không có lịch.
- Thêm cột/nhãn nguồn: Máy, GPS hoặc IP.
- Raw tab đổi thành “Lịch sử sự kiện”, bao gồm cả lần thành công và bị từ chối.
- Cấu hình quy tắc ca và chính sách GPS/IP đều theo cửa hàng.
- Giữ nguyên FILO và export Excel hiện có.

Phần nhân viên nên đặt tại route chung như `/employee/attendance`, có cả desktop/mobile dùng một shared component. Không nên cho nhân viên đi vào route quản lý chỉ để check-in.

## Phân quyền cần bổ sung

Có thể giữ hai quyền hiện tại và bổ sung quyền thao tác:

- `page.hr.attendance`: xem dữ liệu quản lý.
- `hr.attendance.configure`: cấu hình.
- `action.attendance.punch`: nhân viên chấm công.
- `action.attendance.export`: xuất bảng công.
- `action.attendance.adjust`: sửa thủ công, nếu triển khai sau.

Mọi quyền và phạm vi cửa hàng phải được kiểm tra lại ở API:

- Admin/super admin: tất cả cửa hàng.
- Store manager: cửa hàng của mình.
- Office: chỉ các `managedStoreIds`.
- Employee: chỉ được punch và xem dữ liệu của chính mình.

Không dựa vào `hasPermission()` ở client vì nó chỉ bảo vệ giao diện.

## Kế hoạch triển khai

### Giai đoạn 1 — Nền tảng và bảo mật

- Tạo policy và event types.
- Xây helper xác thực session, permission và phạm vi cửa hàng.
- Thêm tọa độ cửa hàng.
- Tạo policy API và unit test GPS/IP.
- Bổ sung audit log cho thay đổi cấu hình.

### Giai đoạn 2 — Chấm công phần mềm

- Xây context API và punch API.
- Làm shared check-in/check-out component.
- Tạo desktop/mobile employee attendance page.
- Hiển thị phương thức xác minh và trạng thái trong ngày.
- Không hỗ trợ offline trong bản đầu; luôn lấy thời gian chuẩn từ server.

### Giai đoạn 3 — Hợp nhất trang quản lý

- Chuyển `/manager/hr/attendance` sang dữ liệu theo `storeId`.
- Loại bỏ phụ thuộc `mappedEmployees`.
- Hợp nhất máy/GPS/IP trong cùng daily response.
- Dùng lịch phân ca để xác định ca và trường hợp vắng mặt.
- Cập nhật raw history và Excel export.

### Giai đoạn 4 — Chuẩn hóa ZKTeco đa cửa hàng

- Tạo `attendance_devices` với `deviceId`, `storeId`, endpoint bridge.
- Đổi mapping thành khóa `deviceId + zkUserId`.
- Đổi idempotency key thành `deviceId + zkUserId + timestamp`.
- Backfill `storeId` và normalized events cho dữ liệu cũ.
- Chuyển sync thủ công sang job định kỳ nếu hạ tầng cho phép.

### Giai đoạn 5 — Chức năng nâng cao từ JPULSE

Triển khai sau khi luồng chính ổn định:

- Danh sách miễn chấm công.
- Báo đến trễ.
- Công tác/work from home.
- Nhật ký lần thử bị từ chối.
- Điều chỉnh công có phê duyệt.
- Cảnh báo thiếu check-out.
- Báo cáo vắng mặt và sai lệch với lịch phân ca.

## Các quyết định nên chốt trước khi code

- Cửa hàng dùng máy có được phép dùng phần mềm dự phòng hay không. Khuyến nghị ban đầu: không, tránh hai nguồn tạo punch trùng.
- Phần mềm có check-out hay chỉ check-in. Khuyến nghị: có cả hai.
- Danh sách phải chấm công lấy toàn bộ nhân viên cửa hàng hay chỉ nhân viên có lịch trong ngày. Khuyến nghị: ưu tiên lịch, fallback theo nhân viên cửa hàng.
- Public IP và tọa độ chính thức của từng cửa hàng.
- Thời gian lưu dữ liệu GPS chi tiết vì đây là dữ liệu nhạy cảm.

Hiện tại mình mới phân tích và lập kế hoạch, chưa thay đổi file nào trong hai dự án.