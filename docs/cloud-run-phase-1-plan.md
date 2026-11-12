# Cloud Run: kế hoạch đợt đầu và các khoản cần xác nhận

Ngày: 19/10/2026. Trạng thái: khảo sát repo và soạn kế hoạch; chưa có tài nguyên cloud hoặc chi phí triển khai nào được duyệt trong chat này.

## Cập nhật phạm vi đã chốt

Người dùng xác nhận mang nguyên source hiện tại lên Cloud Run, giữ nguyên các chức năng đã vô hiệu trong source và tắt thêm AI. Không tách module hoặc yêu cầu người dùng chọn lại từng chức năng. Nội dung kiểm kê module bên dưới chỉ dùng để kiểm tra phụ thuộc. Giữ nguyên yêu cầu không Load Balancer và xác nhận trước mọi thao tác ảnh hưởng chi phí.

Thay đổi local: thêm action.ai.chat vào danh sách quyền vô hiệu, ẩn AI đối với cả admin/super_admin theo cơ chế hasPermission hiện có; chặn POST /api/chat trước parse body, kiểm tra provider hoặc truy vấn dữ liệu; chặn GET /api/ai-usage trước đọc Firestore. Hai endpoint trả 410/AI_DISABLED với Cache-Control: no-store. Mã AI và dependency giữ lại trong source, không chuyển API key AI vào runtime Cloud Run. Thay đổi này chỉ có hiệu lực trên bản được deploy sau đó, không tắt deployment cũ hoặc gateway Cloudflare độc lập. Không xóa key/tài nguyên cloud hoặc thay gói dịch vụ khi chưa được xác nhận.

Hướng triển khai hiện hành: một ứng dụng Next.js nguyên source (frontend và API), một Cloud Run service, URL HTTPS run.app ban đầu, Firebase giữ nguyên. Chuẩn bị Dockerfile/.dockerignore và cấu hình local sau bước này; loại secrets, khóa và backup khỏi image. Header service worker từ vercel.json cần chuyển sang cấu hình Next.js. Cron trong vercel.json không tự chạy trên Cloud Run; việc tạo Scheduler hoặc chuyển/dừng cron Vercel vẫn cần xác nhận chi phí riêng. Không đổi quyền/vô hiệu API nghiệp vụ khác ngoài yêu cầu tắt AI.

Trước deploy vẫn cần chốt project/region, cấu hình tài nguyên, billing, cách build và thời gian giữ tài nguyên; trình dự toán cụ thể và đợi xác nhận. Trạng thái phần còn lại trên Vercel sau cutover chưa được chốt; không tự hủy dịch vụ.

## 1. Yêu cầu đã chốt

- Mang nguyên source hiện tại, giữ các chức năng đã vô hiệu; tắt thêm AI. Không tách module.
- Không sử dụng Load Balancer.
- Tải sử dụng ban đầu thấp. Đề xuất tính phí theo request, min instances = 0; đây là cấu hình chờ duyệt, chưa triển khai.
- Bất kỳ thao tác nào có thể ảnh hưởng chi phí phải được người dùng xác nhận trước, kể cả dự kiến nằm trong free tier, làm giảm chi phí hoặc ảnh hưởng dịch vụ đang trả tiền.
- Các con số đã trao đổi, kể cả 100.000–400.000 đồng/tháng, là dự trù ban đầu, không phải ngân sách đã được người dùng phê duyệt hoặc giới hạn thanh toán được bảo đảm.
- Đã chốt source triển khai; chưa chốt việc tiếp tục/ngừng Vercel. Không tự hủy hoặc đổi cấu hình Vercel.

## 2. Các phần có thể chuyển và phụ thuộc cần đi kèm

Danh sách sau là bản kiểm kê phụ thuộc theo mã nguồn. Source được giữ nguyên theo xác nhận mới; không cần tách module hoặc lập allowlist build. Các mô tả “nếu chọn” bên dưới là khảo sát trước khi phạm vi được chốt.

| Nhóm | Mã nguồn/route đại diện | Cần mang theo nếu chọn nhóm | Chi phí có thể bị ảnh hưởng |
|---|---|---|---|
| Chấm công/nhân sự | /manager/hr/*, /api/hr/*, lib/attendance/* | Auth, roles, workplaces, stores, export và các lib nghiệp vụ được gọi | Cloud Run, đọc/ghi Firestore, băng thông, log |
| Lịch làm/KPI | /manager/scheduling/*, /api/schedules/*, /api/register/*, /api/kpi-* | Auth, nhân viên, cửa hàng, policy | Firestore, compute và file xuất nếu có |
| Kho | /manager/inventory/*, /admin/inventory/*, /api/inventory/* | Auth, products/categories dùng thực tế, warehouses, counters, stores | Firestore, compute, ảnh/file và upload |
| Quét/tra cứu sản phẩm | /product-scanner, /p/[sku] | Auth nếu trang yêu cầu, truy vấn sản phẩm, ảnh public và scanner components | Firestore, Cloud Run, tải ảnh và network |
| Theo dõi link | /office/tracking/*, /api/tracking/*, /r/[slug] | Dữ liệu short_links/link_visits, dịch vụ tra IP được mã hiện tại gọi | Firestore read/write theo lượt truy cập, compute, external API/network |
| Quản trị dùng chung | /api/auth/*, /api/me/*, /api/roles/*, /api/stores/*, /api/users/*, /api/workplaces/* | Chỉ endpoint thật sự được module đã chọn sử dụng; không mặc định đưa seed/debug/migration endpoint lên public | Firestore/Auth, compute |
| Thông báo | /notifications, /api/admin/broadcast, lib/firebase-messaging.ts | Quyền thông báo, token thiết bị, service worker nếu có web | Firestore, compute/network; không mặc định mỗi push có phí FCM |
| AI | /api/chat, /api/ai-usage, lib/ai/* | Provider API, quyền truy cập, giới hạn usage; gateway nếu đang dùng thực tế | Cloud Run trong thời gian streaming, token AI, egress |
| Máy chấm công | /api/cron/attendance-sync, /api/zkteco/*, services/zkteco-bridge | Bridge, đường mạng, auth cron, chống chạy trùng | Scheduler, compute/Firestore/log mỗi lần sync; VPN/NAT nếu thật sự cần |
| Voucher/sự kiện/email | /api/vouchers/*, /api/events/*, /api/v1/events/*, actions liên quan | Chỉ xem xét khi người dùng chủ động chọn, vì một số UI đã tắt | Email, Firestore, compute, QR/ảnh/network |

### Các trang đã tắt trong repo

Nguồn: lib/disabled-features.ts, được middleware và quyền giao diện sử dụng:

- /greensm
- /admin/events
- /admin/vouchers
- /office/inventory/approvals
- /admin/products/products
- /admin/inventory/overview
- /manager/inventory/order
- /admin/daily-report
- /office/revenue

Đề xuất không chuyển các trang này trong đợt đầu, trừ khi người dùng chọn lại. Tắt UI không đồng nghĩa API/Server Actions và dependency đã bị loại khỏi bản build. Không xóa API theo tên nhóm khi chưa kiểm tra nơi gọi; ví dụ trang products bị tắt nhưng scanner hoặc kho có thể vẫn cần dữ liệu sản phẩm.

### Phần dùng chung phải kiểm tra

- app/layout.tsx và desktop/mobile layouts: AuthProvider, guard, profile completion, navigation, scanner modal, PWA và push.
- contexts/AuthContext.tsx: /api/auth/session, /api/me/workplaces và truy vấn Firestore trực tiếp. Chuyển một page có thể kéo theo nhiều API hoặc truy vấn nền.
- Firebase Admin hiện dùng cert/private key: thiết kế dùng runtime service account/ADC; kiểm tra quyền ký custom token vì session recovery có createCustomToken.
- Middleware: phân tuyến desktop/mobile, trang bị tắt, CORS và điều hướng. Quyền API phải được kiểm tra phía server.
- public assets, fonts, manifest, service worker và header hiện nằm trong vercel.json: chỉ mang phần cần cho frontend được chọn.
- Secrets: chỉ lập danh sách tên và mục đích; không chép hoặc in giá trị trong tài liệu/build context. Docker context phải loại .env, khóa, backup Auth/Firestore, exports, node_modules và dữ liệu nhạy cảm không phục vụ runtime.

## 3. Hướng triển khai tối thiểu chờ duyệt

Một Cloud Run service chạy nguyên ứng dụng Next.js hiện tại, gồm frontend desktop/mobile và API; giữ các chức năng đã vô hiệu và chặn thêm AI. Dùng URL HTTPS *.run.app của Google cho lần triển khai đầu nếu được chấp thuận. Cloud Run vẫn tính phí runtime/network trên URL này. Domain riêng là quyết định sau, không tự thay DNS hoặc trỏ domain hiện tại; không đưa Load Balancer vào cấu hình.

Không tách module, không dựng proxy Vercel chỉ để chuyển một số API. Dùng cùng Firebase project không tự chia sẻ cookie hoặc local persistence giữa domain Vercel và run.app; dự kiến cần đăng nhập trên origin mới. Cấu hình build chỉ mang các biến public cần thiết; runtime không nhận key AI và image không chứa .env/backup/khóa riêng.

Giữ nguyên Firebase project và schema ở bước đầu; không tự bật Blaze, đổi billing account, di chuyển database/region, sao lưu có phí hoặc tạo bản sao dữ liệu cloud. Chốt region sau khi xác minh vị trí Firestore và người dùng.

## 4. Danh mục chi phí và điểm phải hỏi trước

Tất cả thao tác sau đều đang CHƯA ĐƯỢC DUYỆT, kể cả khi giá có thể bằng 0 nhờ free tier.

| Hạng mục | Khi nào ảnh hưởng chi phí | Việc cần được xác nhận trước |
|---|---|---|
| Cloud Run runtime | Request, startup/shutdown, CPU/RAM và xử lý stream | Tạo/deploy service, truy cập để test, region, resources, timeout, concurrency, min/max instances, public/private ingress |
| Network | Trả HTML/JS/ảnh, download/export, gọi dịch vụ ngoài hoặc truyền liên vùng | Lưu lượng giả định, upload/download, routing/proxy và vùng triển khai |
| Artifact Registry | Lưu image/layer cũ, truyền dữ liệu và scan nếu bật | Tạo repository, push/pull image cloud, số phiên bản giữ lại, scan và cleanup |
| Build | Cloud Build/source deploy/buildpacks; runner CI khác cũng có thể có quota/phí | Chọn build local hay cloud, chạy build cloud, CI triggers và mỗi lần deploy theo phạm vi đã duyệt |
| Secret Manager | Số secret version và lượt access | Tạo, cập nhật hoặc đọc secret qua cloud; không coi quota miễn phí là quyền tạo |
| Logs/Monitoring | Log ingestion/retention, metrics/alert channels có phí tùy loại | Retention, volume, sampling, metrics và kênh cảnh báo |
| Cloud Scheduler | Số job; mỗi execution còn tạo compute/DB/network | Tạo/bật job, tần suất, retry, timeout và target; không tự chuyển cron Vercel |
| Firestore | Reads/writes/listeners/index/storage, query hoặc backfill trong kiểm thử | Chạy test kết nối dữ liệu thật, thao tác dữ liệu, thay index/backup/PITR/region |
| Firebase Storage/Auth | Lưu file/download/operations và tính năng Auth có phí như SMS tùy cấu hình | Upload/download thử, SMS/Auth có phí, nâng plan hoặc thay cấu hình billing |
| AI/email/external APIs | Token, requests, mail gửi, quota và gói của provider | Smoke test thật, thay model/provider, gửi thử hoặc retry hàng loạt |
| Staging/preview | Service, image, data, build và test traffic riêng | Tạo môi trường, số lượng và thời gian giữ; không tự bật preview theo mỗi PR |
| Backup/export | Storage, reads/exports và restore | Tạo snapshot/export/restore cloud hoặc bật lịch backup |
| Domain/DNS/network riêng | Domain/zone, private connectivity, IP, NAT, VPN/VPC connector | Đăng ký/bật dịch vụ, map domain hoặc đổi DNS; Load Balancer nằm ngoài phạm vi |
| Billing/support/đối tác | Phương thức thanh toán, thuế, hỗ trợ hoặc phụ phí hợp đồng | Link/chuyển billing, nâng plan, mua dịch vụ, đăng ký support hoặc cam kết chiết khấu |
| Vercel chạy song song | Phí hiện tại tiếp tục; proxy/traffic thay đổi có thể tạo usage | Thay routing/env/cron, deploy Vercel, hủy/đổi gói hoặc dừng dịch vụ |

Không chạy test integration/load test có kết nối production trong giai đoạn lập kế hoạch. Local build/dev cũng có thể gọi dữ liệu hoặc API thật trong quá trình render, nên chỉ chạy sau khi kiểm tra và cô lập bằng emulator/dữ liệu cục bộ, hoặc được duyệt cho các lượt gọi thật.

## 5. Trình tự thực hiện

| Bước | Công việc | Điều kiện trước khi thực hiện |
|---|---|---|
| 0 — Đang thực hiện | Đọc mã nguồn, đối chiếu tài liệu giá, lập kế hoạch trên máy | Đã được yêu cầu trong chat; không kết nối workload production |
| 1 — Phạm vi source đã chốt | Nguyên source, giữ chức năng đã vô hiệu và tắt AI; cron cần cấu hình riêng | Không cần hỏi lại danh sách module; chưa tự dừng Vercel |
| 2 — Chuẩn bị local | Dockerfile/.dockerignore cho nguyên ứng dụng, cấu hình chưa chạy, ví dụ env không secrets, unit test/emulator | Chỉ thao tác local không gọi dịch vụ thật; không push vào pipeline tự deploy |
| 3 — Trình cấu hình và chi phí | Ghi project/region, resource, cách build, storage image, log/secret, quota hiện có, lưu lượng giả định và tác động Firebase/Vercel | Hoàn thành thiết kế review được trước khi hỏi duyệt chi phí |
| 4 — Tạo và thử trên cloud | Provision/build/push/deploy và smoke test theo đúng gói hành động được duyệt | Người dùng xác nhận rõ dịch vụ/cấu hình, chi phí ước tính và phạm vi test |
| 5 — Chuyển sử dụng thật | Sửa UI/API URL hoặc domain/routing, cron và mở traffic | Người dùng xác nhận tác động chi phí khi chạy thật; không dùng duyệt smoke test để suy ra duyệt production |
| 6 — Theo dõi và kết thúc | Quan sát usage theo phạm vi được duyệt, đề xuất điều chỉnh/cleanup | Mọi thay đổi ảnh hưởng chi phí, kể cả xóa/giảm tài nguyên/hủy gói, cần xác nhận trước |

Một lần xác nhận có thể áp dụng cho nhóm hành động được liệt kê cụ thể. Không suy ra quyền chạy lại build/deploy/load test, nâng cấu hình hoặc dùng ngân sách chưa sử dụng nếu chưa nằm trong phạm vi đã duyệt. Nếu cần thay đổi, trình phần chênh lệch và đợi xác nhận mới.

## 6. Mẫu nội dung trình duyệt chi phí trước triển khai

- Nguyên source hiện tại và các chức năng đã vô hiệu/AI bị chặn; cron được xử lý riêng và kế hoạch giữ/ngừng Vercel.
- Tài khoản/project/billing/region và quyền thao tác; không in secrets.
- Tài nguyên mới, tài nguyên thay đổi và ảnh hưởng các dịch vụ đang hoạt động.
- CPU/RAM/min/max instances/concurrency/timeout; build local hoặc cloud; số image/secret và log retention.
- Số lượt smoke test, đọc/ghi Firestore, tải file, gọi AI/gửi email và side effects nếu có.
- Chi phí khởi tạo/build/test và chi phí tháng theo tải giả định; tách thuế, phí cũ và phí tăng thêm.
- Thời gian chạy thử/giữ tài nguyên; ngưỡng cảnh báo và chính sách khi chạm ngân sách để người dùng chọn.
- Danh sách lệnh/hành động dự kiến, phương án rollback và bước nào cần xác nhận riêng.

Ngân sách dự trù không phải hard cap. Max instances cũng không giới hạn được toàn bộ hóa đơn (DB/network/AI/build/image/log). Nếu chọn spend cap hoặc cơ chế dừng tự động thì trình rõ phạm vi bảo vệ và nguy cơ gián đoạn, rồi xin xác nhận trước khi bật.

## 7. Dữ liệu còn thiếu

1. Việc giữ/ngừng deployment Vercel sau cutover; không cần chọn lại chức năng hoặc UI/API.
2. URL run.app có chấp nhận được cho đợt thử không.
3. Tải dự kiến, project/region/billing, quota/free tier đã dùng, nhu cầu cron/email và mức ngân sách người dùng chọn duyệt. AI đã được yêu cầu tắt.

Không cần cung cấp private key hoặc API key trong chat để lập kế hoạch.

## 8. Nguồn giá chính thức

Tra cứu ngày 19/10/2026; cần kiểm tra lại trước khi trình duyệt cấu hình cuối cùng.

- [Cloud Run](https://cloud.google.com/run/pricing)
- [Artifact Registry](https://cloud.google.com/artifact-registry/pricing)
- [Cloud Build](https://cloud.google.com/build/pricing)
- [Secret Manager](https://cloud.google.com/secret-manager/pricing)
- [Cloud Scheduler](https://cloud.google.com/scheduler/pricing)
- [Logging và Monitoring](https://cloud.google.com/products/observability/pricing)
