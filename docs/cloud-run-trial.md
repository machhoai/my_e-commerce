# Bản thử Cloud Run giữ Vercel hoạt động

## Cập nhật ngày 20/10/2026: nối bridge chấm công

Theo yêu cầu và xác nhận chi phí bổ sung, production đã chuyển sang revision `jw-erp-trial-00002-yup` có cấu hình gọi `jw-zkteco-bridge` qua run.app. `ZKTECO_API_KEY` tham chiếu Secret Manager version 1; chỉ runtime ERP được thêm quyền đọc secret này. Override endpoint riêng deployment giữ nguyên Firestore và Vercel/Render. Hai domain `erp.joyworld.vn` và `employee.joyworld.vn` đã có sẵn và đều trả login 200; không đổi DNS. Không tạo cron hoặc networking có phí. Kiểm tra đọc máy timeout; người dùng xác nhận host/cổng và cho biết máy có thể chưa có nguồn. Chi tiết, giới hạn kiểm thử và trạng thái thiết bị ở `docs/zkteco-cloud-run-migration.md`. Các phần bên dưới lưu lịch sử đợt thử ban đầu ngày 19/10/2026.

## Phạm vi

- Nguyên source Next.js, giữ các chức năng đã vô hiệu; AI bị chặn phía API và quyền giao diện.
- Service mới dự kiến `jw-erp-trial`, compute project `jw-system-f2104`, region `asia-southeast1`. Firebase hiện hữu thực tế là `e-commerce-72a4b`, cũng ở Singapore; không đổi dữ liệu sang project compute. Cấu hình gcloud mặc định không phải nguồn xác định Firebase project.
- URL run.app; không đổi DNS/domain, không deploy lại Vercel hoặc tạo pipeline tự động.
- Đề xuất request-based billing, 1 vCPU/1 GiB, min=0/max=1; cấu hình này giảm usage nhưng không phải hard cap.
- Không tạo Scheduler. Cron chấm công Vercel tiếp tục như cũ. Không mang CRON_SECRET hoặc key AI sang bản thử.
- Build local; Artifact Registry lưu image vẫn có thể phát sinh phí. Docker daemon cần hoạt động.

## Tiến độ

- [x] Xác minh gcloud đăng nhập và project đã có billing.
- [x] Xác minh Firestore ở asia-southeast1; các API Cloud Run/Artifact Registry đã bật.
- [x] Tắt AI local.
- [x] Chuẩn bị Dockerfile, context allowlist, standalone và header PWA.
- [x] Chuẩn bị ADC; giữ cách dùng credentials hiện tại cho Vercel.
- [x] Build và kiểm tra image local với public build variables; không copy .env, backup hoặc private key.
- [x] Nhận xác nhận chi phí cho push/deploy/test/giữ tài nguyên.
- [x] Xác minh IAM và runtime identity: Firestore/Auth tại e-commerce-72a4b và quyền ký custom token trên signer thuộc Firebase project. Chưa thử đăng nhập/phục hồi phiên thực.
- [x] Push image, deploy service mới và ghi lại URL/revision.
- [x] Chạy đủ 10 lượt kiểm tra đã duyệt: 9 HTTP checks đạt, mobile hiển thị form nhưng kiểm thử trình duyệt chưa đạt do React hydration #418.

## Kết quả triển khai thực tế

- URL chạy thử: https://jw-erp-trial-107789134874.asia-southeast1.run.app
- URL alias từ status Cloud Run: https://jw-erp-trial-cxwygwr7wa-as.a.run.app
- Revision: jw-erp-trial-00001-58p; Ready/ConfigurationsReady/RoutesReady đều True.
- Image: asia-southeast1-docker.pkg.dev/jw-system-f2104/cloud-run-source-deploy/jw-erp-trial:20261019-1
- Digest: sha256:2d0c98b9a7e8d6c5aaf223c22d29a0a6fda04b5438a0d116203bfdab8fa50d7f
- Đã xác minh CPU=1, RAM=1Gi, max=1 tại service và revision, min mặc định=0, concurrency=20, request timeout=60s, CPU throttling=true, startup CPU boost=false.
- Build local thành công; image chạy user node (UID 1000), không chứa .env.local, backup Auth/Firestore, exports hoặc certificates.
- Chế độ CLOUD_RUN_BUILD=1 hoãn đọc bảng xếp hạng dashboard đến runtime, tránh query Firebase trong build không credentials; không thay đổi cách build Vercel khi biến này vắng mặt.
- Không thay đổi Vercel/DNS/domain; không tạo Scheduler/Cloud Build/Load Balancer, không đưa AI key vào runtime.

### Kiểm thử đã chạy

| Kiểm tra | Kết quả |
|---|---|
| GET /login (desktop) | 200 |
| POST /api/chat | 410, AI_DISABLED |
| GET /api/ai-usage | 410, AI_DISABLED |
| GET /greensm | 404 |
| GET /mobile/admin/vouchers | 404 |
| GET /sw.js | 200; Cache-Control và Service-Worker-Allowed đúng |
| GET /firebase-messaging-sw.js | 200; Cache-Control đúng |
| GET /api/auth/session, không cookie | 401; không truy vấn phiên người dùng |
| GET /api/cron/attendance-sync | 503 do không cấu hình CRON_SECRET; không đồng bộ thiết bị |
| Mobile browser /login | 200; form mật khẩu hiển thị, screenshot đã lưu; có React hydration error #418 nên assertion trình duyệt thất bại |

Không đăng nhập, submit biểu mẫu, gọi provider AI, gửi email/push hoặc chạy tác vụ ghi dữ liệu nghiệp vụ. Browser chặn các API và tích hợp ngoài trong lúc mở login. Đã dùng đủ 10 lượt đã duyệt; chưa chạy thêm kiểm thử cloud.

Screenshot: outputs/cloud-run-trial/login-mobile.png. Lỗi hydration chưa được sửa/deploy lại; khả năng liên quan tới usePathname trên route rewrite ở app/mobile/layout.tsx cần tái hiện local để xác nhận, chưa kết luận nguyên nhân. Không báo toàn bộ kiểm thử đều đạt.

### Môi trường local

Docker Desktop ban đầu không khởi động do socket cũ không truy cập được. Đã giữ bản sao các thư mục socket tại AppData/Local/Docker/run.before-cloud-run-trial*, AppData/Local/docker-secrets-engine.before-cloud-run-trial* rồi khởi động thành công. Không reset Docker, xóa image/volume hoặc sửa cấu hình inference. Không tự xóa các bản sao này.

## Cấu hình và giới hạn của lần thử

Các NEXT_PUBLIC_* được đóng vào JS trong lúc build, chỉ lấy allowlist từ cấu hình hiện tại. Không đưa server secrets vào build args/image. Runtime dùng service account/ADC, không tải private key lên image. Khi deploy phải đặt FIREBASE_ADMIN_PROJECT_ID.

FIREBASE_ADMIN_PROJECT_ID phải là e-commerce-72a4b. Runtime identity jw-erp-trial@jw-system-f2104.iam.gserviceaccount.com được cấp quyền dữ liệu/Auth tại Firebase project. Custom token phải ký bằng service account thuộc Firebase project qua FIREBASE_ADMIN_SERVICE_ACCOUNT_ID và quyền ký IAM, không dùng private key hoặc chuyển dữ liệu. Không cấp quyền dữ liệu ERP ở jw-system-f2104.

Nếu giữ origin run.app mới, người dùng cần đăng nhập lại; không tự thay authorized domains, cookie domain hoặc API-key restriction. Nếu bị chặn, báo rõ và chuẩn bị thay đổi để duyệt trước khi áp dụng. Các URL metadata/QR hiện còn có thể trỏ domain production; không tự đổi hàng loạt URL hoặc QR hiện hữu.

Runtime chưa có secrets cho email, ticket/WMS/bridge hoặc hệ thống ngoài. Kiểm kê tên biến và phạm vi quyền trước khi chuyển; các tích hợp cần secrets chỉ được bật sau khi xác nhận thao tác và chi phí. Không coi trang login tải được là toàn bộ nghiệp vụ đã kiểm thử.

Chấm công dựa vào IP cần kiểm chứng header mà Cloud Run thực sự cung cấp. Không mặc định tin phần tử đầu X-Forwarded-For do client gửi và không hạ kiểm tra IP để chạy thử.

## Trạng thái xác nhận chi phí

Đã được người dùng xác nhận trong chat ngày 19/10/2026: “Đồng ý phạm vi và dự trù này”. Gói đã duyệt: build local, push image vào repository hiện hữu, service 1 vCPU/1 GiB min0/max1, tối đa 10 lượt kiểm tra trang/API không ghi dữ liệu nghiệp vụ; dự trù push/kiểm tra dưới 1 USD, duy trì tải thấp 4–16 USD/tháng chưa gồm Firebase/thuế, không phải hard cap. Không chạy Cloud Build, Scheduler, Load Balancer, domain hoặc AI.

Nguồn yêu cầu giữ Vercel, không đổi DNS và dùng run.app: chỉ dẫn người dùng trong chat ngày 19/10/2026. Mọi thay đổi ngoài gói đã được duyệt cần xác nhận mới.
