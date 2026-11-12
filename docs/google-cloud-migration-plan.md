# Kế hoạch chuyển Vercel sang Google Cloud

> Cập nhật 19/10/2026: phạm vi đã đổi thành chỉ một số chức năng, không dùng Load Balancer và mọi thao tác có thể ảnh hưởng chi phí đều cần người dùng xác nhận trước. Kế hoạch hiện hành: [Cloud Run — phạm vi đợt đầu và xác nhận chi phí](cloud-run-phase-1-plan.md). Các đề xuất chuyển toàn bộ ứng dụng, Load Balancer, dịch vụ phụ trợ và ngân sách trong bản ngày 15/10 bên dưới chỉ còn là tham khảo, không phải cấu hình được duyệt.

Ngày đánh giá: 15/10/2026. Phạm vi: khảo sát mã nguồn và tài liệu chính thức; chưa truy cập cấu hình production, tài khoản billing, số liệu sử dụng hay hóa đơn thực tế. Đây là kế hoạch, chưa thay đổi hạ tầng.

## 1. Đề xuất

Chuyển Next.js và API từ Vercel sang Cloud Run; giữ nguyên Firebase project, Firestore, Authentication, Storage và FCM trong đợt đầu. Dùng Cloud Build, Artifact Registry, Secret Manager, Cloud Scheduler, Cloud Logging/Monitoring. Chọn cơ chế hợp đồng và chứng từ trước khi chuyển production.

Firebase App Hosting là phương án thay thế nếu thử nghiệm chứng minh tương thích với Next.js 16.0.7, cấu hình build và các luồng nghiệp vụ hiện có. Không đổi framework hoặc database chỉ để chuyển hosting.

Mục tiêu nên đo bằng số đầu mối thanh toán, số chứng từ phải xử lý, thời gian đối soát và tổng chi phí vận hành. Hạ tầng Google không đồng nghĩa mọi sản phẩm Google hoặc bên thứ ba dùng chung một hóa đơn.

## 2. Hiện trạng từ repo

| Thành phần | Bằng chứng | Hệ quả |
|---|---|---|
| Next.js 16.0.7, React 19.2 | package.json và phiên bản next đã cài | Cần Node runtime, không thể chỉ đưa toàn bộ ứng dụng lên static hosting |
| 86 file API route.ts | app/api | Kiểm thử theo nhóm nghiệp vụ và mức độ quan trọng |
| Firebase Auth, Firestore, Storage, FCM | lib/firebase.ts, lib/firebase-admin.ts, lib/firebase-messaging.ts | Phần dữ liệu đã thuộc Google; có thể giữ project và UID |
| Firebase Admin dùng private key | lib/firebase-admin.ts | Nên chuyển sang Application Default Credentials và service account runtime |
| Khôi phục phiên bằng custom token | app/api/auth/session/route.ts | Cần kiểm thử quyền ký token khi bỏ private key, ngoài quyền đọc Firestore |
| Cron 5 phút, giới hạn khai báo 300 giây | vercel.json, app/api/cron/attendance-sync/route.ts | Chuyển Scheduler; giới hạn Next.js maxDuration không tự cấu hình timeout Cloud Run |
| Service worker/PWA và header riêng | vercel.json, next.config.ts, middleware.ts | Di chuyển header, kiểm thử cache, push và rewrite desktop/mobile |
| AI Anthropic, Groq, Google; mã Cloudflare gateway | app/api/chat/route.ts, workers/anthropic-gateway | Chuyển hosting chưa loại bỏ mọi nhà cung cấp hoặc hóa đơn ngoài Google |
| Email Brevo hoặc Gmail | app/api/vouchers/send-email/route.ts | Cần chốt nhà cung cấp và quota trước khi loại bỏ Brevo |
| Python bridge ZKTeco, raw TCP | services/zkteco-bridge | Cần kiểm tra nơi bridge thực sự chạy và đường mạng tới máy vật lý |
| canvas, báo cáo Excel/PDF | package.json | Kiểm thử thư viện native, font, bộ nhớ và file tạm trong container |

Sự tồn tại của cấu hình/mã không chứng minh dịch vụ đang hoạt động trên production. Chưa biết region Firestore, mức chi phí, DNS, quyền IAM, quotas, vị trí bridge hoặc số lượng người dùng đồng thời.

## 3. Chứng từ và phương thức mua dịch vụ

Giả định chính: mục tiêu là đơn giản hóa chứng từ chi phí cloud của doanh nghiệp. Nếu mục tiêu là phiếu thu, thanh toán khách hàng hoặc hóa đơn bán hàng trong ứng dụng thì cần dự án nghiệp vụ riêng; thay hosting không tự sinh các chức năng đó.

| Cách mua | Lợi ích | Điều phải xác minh |
|---|---|---|
| Google trực tiếp, self-serve | Chủ động tài khoản, tải tài liệu billing/receipt; danh sách chính thức có Vietnam/VND/credit card | Pháp nhân bán hàng, loại chứng từ được cấp thực tế, thông tin công ty/MST, chu kỳ trừ tiền, điều kiện kế toán chấp nhận |
| Google trực tiếp, monthly invoicing | Chu kỳ công nợ và chuyển khoản theo điều khoản được Google duyệt | Phải đăng ký và được xét điều kiện; không mặc định tài khoản nhỏ được cấp |
| Đối tác Google Cloud có hợp đồng tại Việt Nam | Có thể đàm phán bộ hồ sơ và hỗ trợ thanh toán phù hợp quy trình nội bộ | Xác minh tư cách đối tác, hóa đơn mẫu, phí/phụ phí, phạm vi Firebase và AI được bao gồm, quyền sở hữu và điều kiện rời đối tác |

Không dùng tài liệu thuế của Google Ads hoặc Workspace để suy ra chính sách Google Cloud. Không mặc định statement, receipt hay invoice nước ngoài tương đương hóa đơn điện tử GTGT đáp ứng yêu cầu của doanh nghiệp.

Điều kiện hoàn thành giai đoạn billing: kế toán duyệt một bộ mẫu gồm hợp đồng/điều khoản, thông tin bên bán/mua, MST, chứng từ tính phí và chứng từ thanh toán; xác nhận đồng tiền, thuế và phương thức thanh toán. Nếu mua qua đối tác, yêu cầu xác nhận bằng văn bản và quyền kiểm soát project của doanh nghiệp.

## 4. So sánh triển khai

| Tiêu chí | Giữ Vercel | Firebase App Hosting | Cloud Run | Compute Engine/GKE |
|---|---|---|---|---|
| Công chuyển đổi | Thấp nhất | Thấp–trung bình nếu tương thích | Trung bình | Cao |
| Trải nghiệm Next.js | Hệ thống đang dùng, cần lấy số liệu làm baseline | Có tích hợp framework; phải kiểm chứng Next.js 16 | Tự đóng gói và quản lý cấu hình Next.js | Tự quản lý nhiều thành phần hơn |
| Build/deploy/preview | Giữ quy trình hiện tại | Tích hợp build/rollout; kiểm tra workflow preview cần dùng | Tự thiết lập pipeline và staging | Tự thiết lập đầy đủ |
| Runtime/native dependency | Theo môi trường Vercel hiện tại | Theo adapter và môi trường build/runtime | Kiểm soát image, thư viện native, timeout, concurrency | Kiểm soát rộng nhất |
| CDN/domain/TLS | Theo cấu hình hiện tại | Có hạ tầng tích hợp | Chọn front door, domain và cache rõ ràng | Tự thiết kế |
| Công vận hành | Ít thay đổi | Thường thấp hơn Cloud Run tự cấu hình | Cần người phụ trách IAM, container, giám sát | Cần năng lực vận hành server/cluster |
| Chứng từ Google | Vercel vẫn là nhà cung cấp riêng | Phụ thuộc billing/hợp đồng | Phụ thuộc billing/hợp đồng | Phụ thuộc billing/hợp đồng |
| Nhận định | Phương án dự phòng nếu billing Google không phù hợp | Phù hợp khi ưu tiên deploy đơn giản và đã qua PoC | Đề xuất cho repo hiện tại | Chỉ cân nhắc cho workload có yêu cầu cụ thể |

Tại thời điểm tra cứu, tài liệu App Hosting nêu Next.js 13.5 trở lên nhưng bảng phiên bản hỗ trợ cụ thể chưa liệt kê 16. Không suy ra tương thích chính thức từ câu mô tả tổng quát. App Hosting yêu cầu Blaze và tính phí cả các dịch vụ nền tảng.

## 5. Kiến trúc mục tiêu

- Web/API: container Next.js trên Cloud Run; Cloud Build tạo image, Artifact Registry lưu image; pin Node version tương thích và kiểm tra bản vá bảo mật trước rollout.
- Dữ liệu: giữ Firebase project hiện tại, không sao chép hoặc đổi UID trong đợt chuyển hosting. Staging dùng project/dữ liệu kiểm thử riêng để tránh ghi nhầm production.
- Domain: đánh giá external Application Load Balancer + managed certificate; thêm Cloud CDN khi thực sự có lợi. Tính cả chi phí nền của load balancer. Chỉ cache tài nguyên public; không cache phản hồi cá nhân, auth hay dữ liệu nhân sự. Cloud Run domain mapping hiện được tài liệu đánh dấu Preview/limited availability; không mặc định chọn cho production.
- Region: ưu tiên gần Firestore và người dùng; thử Singapore nếu phù hợp vị trí dữ liệu. Đo latency và phí liên vùng trước khi chốt. Không đổi region dữ liệu trong cùng đợt.
- Secrets: Secret Manager; runtime service account quyền tối thiểu. Dùng ADC thay khóa JSON. Khôi phục phiên gọi createCustomToken cần cấu hình và thử quyền ký qua IAM; không cấp Owner/Editor để xử lý lỗi quyền.
- Cron: Cloud Scheduler gọi endpoint GET hiện tại với shared secret như bước tương thích ban đầu, quản lý quyền chỉnh job chặt chẽ. Đích dài hạn là worker Cloud Run private + OIDC. Khi chuyển OIDC phải đổi xác thực ứng dụng, không dùng token OIDC thay CRON_SECRET mà giữ nguyên logic kiểm tra cũ.
- Thiết bị: giữ bridge tại nơi có đường mạng ổn định đến máy ZKTeco trong đợt đầu. Nếu đưa bridge lên Google, kiểm tra VPN/định tuyến/egress IP theo yêu cầu thực tế. Dùng khóa phân tán theo deviceId, không chỉ khóa trong một process; thiết bị chỉ nhận một socket.
- Quan sát: log có cấu trúc và request ID, cảnh báo lỗi web/cron/push/email, dashboard chi phí theo project và dịch vụ; không ghi secrets hoặc dữ liệu nhạy cảm vào log.

## 6. Kế hoạch và điều kiện qua từng giai đoạn

Ước lượng sơ bộ cho một kỹ sư quen repo: 10–15 ngày công, thường trải trên 3–4 tuần; chưa gồm thời gian phê duyệt hợp đồng, billing hoặc xử lý mạng thiết bị phức tạp. Cần điều chỉnh sau khảo sát production.

| Giai đoạn | Ước lượng | Công việc và đầu ra |
|---|---|---|
| 0. Billing và baseline | 1–2 ngày | Kế toán duyệt bộ chứng từ mẫu; kiểm kê nhà cung cấp, domain, secrets theo tên; lấy traffic/CPU/bandwidth/Firestore/AI 30 ngày và chi phí Vercel hiện tại |
| 1. PoC | 2–3 ngày | Dựng staging Cloud Run; kiểm tra App Hosting nếu muốn so sánh; build đúng webpack, canvas/fonts, SSR, API, streaming, middleware và ADC/custom token |
| 2. Production foundation | 2–3 ngày | Pipeline, tách quyền build/runtime, secrets, HTTPS/domain, backup/restore thử, monitoring và ngân sách; ghi cấu hình để tái tạo |
| 3. UAT và tải | 2–3 ngày | Kiểm thử các luồng quan trọng; đo p95 và tỷ lệ lỗi; kiểm thử concurrency, cron retry, chống trùng và lỗi từng thiết bị |
| 4. Cutover | 1 ngày | Chuẩn bị DNS/TLS, dừng cron Vercel, chuyển traffic, bật Scheduler Google, xác minh số liệu và khả năng quay lui |
| 5. Theo dõi và bàn giao | 2–3 ngày công phân bổ | Theo dõi ít nhất 7 ngày, kiểm tra hóa đơn đầu tiên khi phát sinh, bàn giao runbook; chấm dứt Vercel sau khi hết cửa sổ rollback |

Chỉ đưa cấu hình migration vào nhánh riêng khi triển khai. Working tree hiện có thay đổi nghiệp vụ chấm công; không trộn các thay đổi này vào bản chuyển hosting nếu chưa xác định baseline phát hành.

## 7. Ma trận rủi ro

Xác suất dưới đây là đánh giá định tính từ cấu trúc mã, chưa phải thống kê sự cố.

| Rủi ro | Khả năng | Tác động | Giảm thiểu |
|---|---|---|---|
| Chứng từ không đạt mục tiêu | Chưa xác định | Rất cao | Duyệt bộ mẫu và hợp đồng trước khi đầu tư migration |
| Next.js 16/adapter hoặc native build lỗi | Trung bình | Cao | PoC với bản đang dùng; container Cloud Run nếu App Hosting không đạt |
| ADC đọc được DB nhưng không ký custom token | Trung bình | Cao | Test phục hồi session/PWA và quyền ký IAM bằng runtime identity |
| Trùng cron hoặc retry đồng thời làm treo máy | Trung bình | Cao | Một scheduler chủ động, khóa theo thiết bị, idempotency và timeout |
| Bridge mất kết nối do thay vị trí/mạng/IP | Trung bình | Cao | Giữ vị trí cũ ban đầu; xác minh mạng trước khi di chuyển bridge |
| Cookie, rewrite, push hoặc SW/cache sai | Trung bình | Cao | Giữ hostname, chuyển headers và test mobile/desktop/PWA trên domain staging và production |
| Chia sẻ cache làm lộ dữ liệu nhân sự | Trung bình nếu cấu hình sai | Rất cao | Bypass cache với auth/API; kiểm thử chéo hai tài khoản/role |
| Cold start hoặc scale tăng latency/chi phí | Trung bình | Trung bình–cao | Load test, chọn min/max instances và concurrency từ số liệu |
| Phí mạng/log/build/AI vượt dự toán | Trung bình | Cao | Mô hình chi phí đầy đủ, cảnh báo và giới hạn tài nguyên; cap có thể gây ngừng phục vụ |
| Rollback gây dữ liệu không tương thích | Thấp nếu không đổi schema | Cao | Cùng Firebase, không đổi schema; kiểm soát side effect và không restore DB chỉ vì rollback web |
| Mất quyền kiểm soát qua đối tác | Phụ thuộc hợp đồng | Cao | Doanh nghiệp nắm tổ chức/project/domain và điều khoản chuyển billing |

Cron hiện có thể trả HTTP 200 khi một số thiết bị lỗi nhưng số khác thành công. Giám sát phải đọc errors và lastSyncStatus từng thiết bị, không chỉ dựa vào HTTP status.

## 8. Kiểm thử và rollback

Điều kiện go-live đề xuất, cần thống nhất với người vận hành:

- Đăng nhập, logout, phân quyền API và khôi phục phiên sau khi xóa local persistence hoạt động; quyền API phải được xác minh phía server, không dựa vào cookie role để bảo vệ dữ liệu.
- Các luồng kho, nhân sự/chấm công, voucher/sự kiện, email, push, AI stream và xuất Excel/PDF đạt UAT; không phát sinh gửi mail/push hàng loạt từ staging.
- Cron chạy ổn ít nhất 24–48 giờ kiểm thử với thiết bị được cho phép; không trùng log/sự kiện và không để máy giữ socket.
- p95 các luồng quan trọng không chậm hơn baseline quá 20% dưới tải tương đương; ngưỡng lỗi và thời gian phục hồi được chốt trước cutover.
- Chứng chỉ hoạt động, backup đã khôi phục thử vào môi trường cô lập, pipeline có thể redeploy image trước đó.

Chuẩn bị DNS TTL thấp ít nhất một chu kỳ TTL trước cutover; DNS rollback không tức thời. Trong thời gian DNS phân tán, cả hai web có thể phục vụ cùng Firebase nên mọi thao tác ghi phải an toàn khi đồng thời và không đổi schema.

Rollback: dừng Scheduler Google, chuyển traffic/DNS về Vercel hoặc đưa revision Cloud Run trước đó về phục vụ theo nguyên nhân; chỉ bật lại cron Vercel sau khi chắc chắn không còn scheduler cạnh tranh. Không phục hồi snapshot DB để quay lui giao diện vì sẽ làm mất các giao dịch phát sinh sau cutover. Mục tiêu thao tác rollback dưới 30 phút; thời gian người dùng thực sự hồi phục còn phụ thuộc DNS/cache.

## 9. Chi phí và đánh giá hiệu quả

Chưa có cơ sở báo giá tháng vì thiếu traffic, CPU/RAM, bandwidth, min instances, vị trí Firestore và usage AI. Không mặc định Google rẻ hơn Vercel.

Tổng chi phí = Cloud Run + front door/CDN/egress + build/registry + secrets/scheduler/logging/monitoring + Firebase hiện hữu + AI/email + phí hỗ trợ/đối tác/thuế theo hợp đồng + công vận hành. Tính riêng chi phí chuyển đổi một lần và thời gian trả phí hai nền tảng trong cửa sổ rollback.

Lập ba kịch bản theo dữ liệu đo: tải nền, cao điểm thực tế và tải gấp đôi cao điểm. So sánh cùng SLA, cùng môi trường staging, cùng mức hỗ trợ và cả thời gian kế toán/DevOps. Free tier chỉ là khoản giảm trừ, không phải cam kết chi phí bằng 0.

Đặt cảnh báo theo ngân sách đã duyệt. Nếu dùng Cloud Run spend cap, phải hiểu đạt cap có thể dừng workload; cap Cloud Run không bao phủ mọi chi phí khác như Firestore/AI và một số thành phần mạng. Không dùng ngắt toàn bộ billing như biện pháp mặc định cho hệ thống nghiệp vụ.

Hiệu quả kinh tế tháng = tiền dịch vụ tiết kiệm + giá trị thời gian đối soát tiết kiệm - công vận hành tăng thêm. Chỉ tính thời gian hoàn vốn nếu hiệu quả tháng dương. Nếu lợi ích chính là chứng từ/hợp đồng thì ghi rõ đó là tiêu chí lựa chọn thay vì gán lợi ích tiết kiệm hạ tầng chưa đo được.

## 10. Lộ trình rời toàn bộ phụ thuộc hosting ngoài Google

Đợt 1: hoàn tất rời Vercel với Firebase giữ nguyên. Đợt 2: kiểm kê dịch vụ đang phát sinh hóa đơn và chuyển gateway Cloudflare đang hoạt động sang Cloud Run nếu cần. Đợt 3: đánh giá AI qua Vertex AI theo model, region và chất lượng thực tế; không mặc định mọi model Anthropic/Groq đều có phương án tương đương hoặc cùng hóa đơn. Email Google Workspace/Gmail cần đánh giá quota và tính phù hợp email giao dịch, đồng thời có thể có chu kỳ thanh toán riêng. Bridge tại cửa hàng là thành phần phần cứng, không nhất thiết là nhà cung cấp cloud phải loại bỏ. GitHub/source control có thể giữ nếu không nằm trong mục tiêu hợp nhất chi phí runtime.

## 11. Nguồn chính thức

- [Cloud Billing: invoice, statement, receipt](https://docs.cloud.google.com/billing/docs/how-to/get-invoice)
- [Đồng tiền và phương thức thanh toán theo quốc gia](https://docs.cloud.google.com/billing/docs/resources/currency)
- [Đăng ký monthly invoicing](https://docs.cloud.google.com/billing/docs/how-to/invoiced-billing)
- [Mô hình Cloud Billing và reseller subaccount](https://docs.cloud.google.com/billing/docs/concepts)
- [App Hosting framework support](https://firebase.google.com/docs/app-hosting/frameworks-tooling)
- [App Hosting costs](https://firebase.google.com/docs/app-hosting/costs)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud Run billing settings và spend caps](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
- [Cloud Run domain mapping](https://docs.cloud.google.com/run/docs/mapping-custom-domains)
- [Cloud Scheduler gọi Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-scheduler)
- [Firebase Admin custom tokens và quyền ký](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
