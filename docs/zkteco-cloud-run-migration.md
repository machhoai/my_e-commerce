# Chuyển ZKTeco bridge từ Render sang Cloud Run

Trạng thái cập nhật ngày 27/10/2026: đã triển khai bridge, nối ERP Cloud Run và đổi host thiết bị sang `bduck.ddns.net` sau xác nhận chi phí bổ sung. Bridge đã đọc thành công 7.039 bản ghi chấm công và 83 người dùng. Giữ nguyên Render, Vercel, DNS; chưa chạy đồng bộ ghi dữ liệu nghiệp vụ vào Firestore. Các mục bên dưới ghi lịch sử triển khai và chẩn đoán từng thời điểm.

## Hoàn tất đổi host ngày 27/10/2026

Người dùng xác nhận “Đồng ý cập nhật và kiểm tra trong phạm vi này” cho đổi riêng `ZK_DEVICE_HOST`, một revision dùng image hiện có và tối đa 5 request health/auth/đọc máy; dự trù dưới 1 USD, không phải hard cap, giữ nguyên compute/scaling và mô hình chi phí duy trì đã duyệt. Không thêm tài nguyên/networking/cron hoặc ghi dữ liệu nghiệp vụ.

- Đã cập nhật `ZK_DEVICE_HOST=bduck.ddns.net`, cổng 4370, device_id `store-01-zk`.
- Revision `jw-zkteco-bridge-00002-9j6` Ready và nhận 100% traffic từ 09:13:50 UTC (16:13:50 giờ Việt Nam).
- Giữ image `jw-zkteco-bridge:20261020-1`, identity, Secret Manager `jw-zkteco-bridge-api-key:1`, CPU 1/RAM 512Mi, concurrency 1, timeout 60s, min mặc định 0, max service/revision 1, CPU throttling bật/startup boost tắt, `ZK_ALLOW_WRITES=false`.
- Đủ 5/5 kiểm tra đã duyệt đạt từ Cloud Run: GET `/` 200; users thiếu key 401; logs sai key 401; logs đúng key/device_id 200 với 7.039 bản ghi trong 3.17 giây; users đúng key/device_id 200 với 83 người dùng trong 0.83 giây. Đã kiểm tra định dạng trường ERP cần; không lưu tên, mật khẩu hoặc log chấm công vào artifact/chat.
- ERP hiện hữu gọi cùng URL bridge, nên không cần deploy lại ERP hoặc đổi DNS. Chưa chạy nút sync với tài khoản người dùng hoặc nhập dữ liệu vào Firestore; kiểm chứng mới bao gồm bridge ↔ máy, không báo toàn bộ luồng nhập liệu đã được kiểm thử.
- Biên bản không chứa secret/dữ liệu cá nhân: `outputs/zkteco-host-update-20261027.json` và `outputs/zkteco-host-update-checks-20261027.json`.

## Kiểm tra lại ngày 21/10/2026 sau khi người dùng báo máy đã có nguồn

### Bổ sung ngày 27/10/2026: host cũ vẫn ở runtime

TCP từ máy tính tới `bduck.ddns.net:4370` đã thành công lúc 09:10:36 UTC, IP `113.171.86.171`, mất 0.08 giây. Chỉ xác minh TCP, chưa thực hiện giao thức ZKTeco hoặc gọi Cloud Run bằng host mới.

Khi người dùng hỏi app vẫn không đồng bộ, đã đối chiếu runtime: ERP revision `jw-erp-trial-00002-yup` gọi đúng bridge; bridge revision `jw-zkteco-bridge-00001-b6v` vẫn cấu hình `ZK_DEVICE_HOST=bduck.fortiddns.com`, DNS trả `113.171.158.41`. Request logs mới nhất lúc 09:09:28 UTC trả 500 sau 43.84 giây. Hai tên miền đang trỏ hai IP khác nhau, chưa thể dùng kết quả TCP trên hostname mới để xác nhận cấu hình production hiện tại hoạt động.

Kế hoạch khi phát hiện host cũ (đã được duyệt và thực hiện trong mục hoàn tất phía trên): chỉ cập nhật env `ZK_DEVICE_HOST=bduck.ddns.net` trên bridge bằng image hiện tại; tạo một revision mới, giữ CPU/RAM/scaling, key, khóa ghi và mọi cấu hình khác. Lệnh đã chạy:

```powershell
gcloud run services update jw-zkteco-bridge --project=jw-system-f2104 --region=asia-southeast1 --update-env-vars=ZK_DEVICE_HOST=bduck.ddns.net --quiet
```

Sau duyệt, chạy tối đa 5 request health/auth/đọc máy, không gọi sync nhập dữ liệu nghiệp vụ, restart, đổi giờ hoặc xóa dữ liệu. Không build/push image mới, thêm cron/NAT/IP tĩnh hoặc đổi DNS. Gói setup 10 checks trước đã hết, không tự dùng lại cho kiểm thử Cloud Run mới. Dự trù cập nhật/kiểm tra dưới 1 USD, không phải hard cap; giữ cấu hình compute và mô hình duy trì đã duyệt. Cần kiểm tra từ Cloud Run vì TCP từ máy tính không bảo đảm đường mạng Cloud Run cũng thông.

- ERP vẫn chạy revision `jw-erp-trial-00002-yup`, 100% traffic; URL/override đều trỏ bridge Cloud Run và key vẫn tham chiếu Secret Manager version 1.
- Bridge runtime đúng `store-01-zk`, `bduck.fortiddns.com:4370`, timeout 15s, writes=false. DDNS vẫn trả `113.171.158.41`.
- Log request thật ngày 21/10 lúc 05:26:42 UTC cho thấy GET logs tới bridge trả 500 sau 43.67 giây. Document cấu hình thiết bị ghi lần đồng bộ 05:27:26 UTC lỗi `ZKTeco worker error [500] ... {"detail":"timed out"}`. Chỉ đọc document để xác minh, không chạy sync hoặc ghi dữ liệu.
- Thử TCP từ máy tính tới DDNS/cổng 4370 lúc 06:59:24 UTC cũng timeout sau 5.3 giây. Lỗi nằm trên đường kết nối/protocol tới thiết bị; chưa xác định chính xác firewall/NAT/host/port/allowlist hoặc thiết bị. Không mặc định chỉ cần bật nguồn là máy đã có mạng, không kết luận cổng 4370 chắc chắn sai.
- Cần đội quản trị mạng xác nhận host public/WAN/DDNS, cổng ngoài/protocol và NAT tới IP LAN/cổng thật của máy; cổng ngoài có thể khác cổng trong máy. Kiểm tra kết nối trong LAN trước và firewall/allowlist nếu LAN chạy nhưng bên ngoài không chạy. Không tự mua NAT/IP tĩnh hoặc đổi timeout/key khi chưa có bằng chứng.
- Đợt này dùng 1 TCP check trong 2 lượt còn lại, nâng tổng setup lên 9/10 checks, tổng đọc cấu hình Firestore 3/20 documents. Không gọi API thiết bị thêm vì đã có bằng chứng timeout từ request production. Biên bản: `outputs/zkteco-connectivity-recheck-20261021.json`.

Người dùng tiếp tục cung cấp IP LAN `192.168.1.240:4370` và yêu cầu thử trực tiếp, bỏ DDNS. TCP connect từ máy tính hiện tại lúc 07:04:56 UTC cũng timeout sau 5.02 giây, không gửi dữ liệu ứng dụng. Đây là kiểm tra từ máy tính hiện tại, không phải từ Cloud Run hoặc bằng chứng đã thử trong LAN cửa hàng. Không sửa host bridge sang IP LAN khi chưa có đường mạng tới LAN đó. Đã dùng đủ 10/10 lượt kiểm tra thuộc gói setup; tổng đọc cấu hình vẫn 3/20. Biên bản: `outputs/zkteco-direct-lan-check-20261021.json`.

## Nối ERP production — phạm vi bổ sung đã duyệt

Ngày 20/10/2026 người dùng yêu cầu “Hãy nối và setup môi trường luôn giúp tôi”, sau đó xác nhận “Đồng ý phạm vi và dự trù này” cho một revision ERP, quyền truy cập secret hiện có, tối đa 20 đọc cấu hình Firestore và 10 request kiểm tra gồm đọc máy thật. Dự trù setup/kiểm tra dưới 1 USD, không phải hard cap; giữ dự trù ERP 4–16 USD/tháng và bridge 2–6 USD/tháng khi tải thấp, chưa gồm Firebase/thuế. Không nhập dữ liệu chấm công trong đợt setup, không thêm cron/networking hoặc đổi DNS. Các lần đồng bộ do người dùng chạy sau đó phát sinh usage Cloud Run/Firebase theo số bản ghi.

Khảo sát đã đọc 2 documents tại Firebase project `e-commerce-72a4b`: một máy `store-01-zk` đang bật với endpoint `https://worker.erp.joyworld.vn`, và một chính sách cửa hàng enabled/MACHINE. Hai domain `erp.joyworld.vn` và `employee.joyworld.vn` đã Ready và trỏ `jw-erp-trial`. ERP runtime hiện tại thiếu toàn bộ biến bridge.

Đã chuẩn bị `ZKTECO_WORKER_URL_OVERRIDE` phía server để riêng revision Cloud Run dùng bridge mới thay endpoint theo máy; không sửa dữ liệu Firestore dùng chung hoặc Vercel. Giữ nguyên ưu tiên endpoint cũ khi biến override không được đặt. Ba kiểm thử offline đạt: URL/key đi cùng nhau, Vercel không có override giữ endpoint cũ, lỗi bridge không gửi key mới sang provider cũ để fallback. ESLint đạt; Docker build production/TypeScript đạt. Image local `jw-erp-trial:20261020-bridge1`, index digest `sha256:78369cc00e4a23621dea1b6c8f78c6781b1534c22e261a1aaa0692e9e5d60073`; image chạy UID 1000, có override trong bundle và không có `.env.local`.

Runtime ERP đã được cấp `secretAccessor` trên riêng `jw-zkteco-bridge-api-key`; không cấp quyền secret ở toàn project. Revision mới dùng `ZKTECO_API_KEY=jw-zkteco-bridge-api-key:1`, `ZKTECO_WORKER_URL` và `ZKTECO_WORKER_URL_OVERRIDE` cùng trỏ URL bridge mặc định, `ZK_DEVICE_ID=store-01-zk`. Các biến Firebase, resource/scaling, domain và quyền khác giữ nguyên.

### Trạng thái production sau nối môi trường

- Revision `jw-erp-trial-00002-yup` đã Ready, nhận 100% traffic từ 04:25:48 UTC ngày 20/10/2026. Hai domain hiện hữu trỏ service này, không đổi DNS.
- Đã deploy candidate với `--no-traffic --tag=zkteco-ready` trước; GET `/login` trả 200, POST `/api/hr/sync-attendance` không đăng nhập trả 401 và không đọc/ghi nghiệp vụ. Đối chiếu secret reference, identity, Firebase env, CPU 1/RAM 1Gi, concurrency 20, timeout 60, max revision 1, CPU throttling bật/startup boost tắt đều đúng.
- Sau khi người dùng xác nhận đúng host/cổng và thông báo “có thể máy chấm công đang không được cấp nguồn”, đã promote chính candidate đó để hoàn tất yêu cầu nối/setup môi trường. Không coi timeout là kiểm thử đạt; không tiếp tục gọi thiết bị mất nguồn. Chưa đăng nhập thay người dùng hoặc chạy sync ghi dữ liệu thật.
- ERP production nay định tuyến tới Cloud Run bridge dù trường endpoint trên UI/Firestore còn URL Render. Override là theo deployment, không sửa endpoint dùng chung; Vercel vẫn dùng Render với key cũ. Không có cron mới trên Cloud Run.
- Image registry: `asia-southeast1-docker.pkg.dev/jw-system-f2104/cloud-run-source-deploy/jw-erp-trial:20261020-bridge1`; revision chạy platform digest `sha256:164519d18302a11ac823e90adeb88299e66a17e620eedf65fa1b5a84649abb6f`.
- Giữ revision trước `jw-erp-trial-00001-58p` để rollback nếu phát hiện lỗi ERP. Rollback traffic về revision trước cũng bỏ cấu hình bridge mới khỏi runtime phục vụ production; không chạy lại deploy script để rollback.
- Kiểm tra sau promote: GET `/login` trên cả `erp.joyworld.vn` và `employee.joyworld.vn` trả 200. Tổng đợt nối dùng 7 HTTP requests và 1 TCP check (8/10 lượt), đọc 2/20 cấu hình Firestore, ghi nghiệp vụ 0. Kiểm thử đăng nhập/đồng bộ thật chưa chạy. Biên bản bổ sung ở `outputs/zkteco-erp-candidate-checks.json` và `outputs/zkteco-erp-production-checks.json`.

### Trở ngại kết nối thiết bị

- GET bridge `/` trả 200; GET users không key trả 401.
- GET logs có đúng key/device_id trả 500 `timed out` sau 40.36 giây; không retry. Cloud Run ghi nhận request tới ứng dụng, không phải lỗi DNS/run.app hoặc API key.
- DDNS `bduck.fortiddns.com` phân giải thành `113.171.158.41`; thử TCP từ máy tính hiện tại tới cổng 4370 cũng timeout sau 5 giây. Chưa xác định là thiết bị/router tắt, thiếu NAT/allowlist, sai host/port hoặc nguyên nhân khác. Không suy luận đây chắc chắn là lỗi IP động Cloud Run, không tự mua NAT/IP tĩnh.
- Đã dùng 3 HTTP checks và 1 TCP check trong gói mới trước khi triển khai candidate; không đọc được log/người dùng, không ghi dữ liệu nghiệp vụ hoặc chạy thao tác ghi thiết bị.
- Biên bản: `outputs/zkteco-production-config-survey.json`, `outputs/zkteco-production-connection-checks.json`, `outputs/zkteco-local-tcp-check.json`.

`scripts/connect-cloud-run-zkteco.ps1` đã triển khai candidate với `--no-traffic --tag=zkteco-ready`, sau đó promote bằng `gcloud run services update-traffic ... --to-revisions=jw-erp-trial-00002-yup=100` để hoàn tất nối cấu hình theo yêu cầu. Không chạy lại script vì candidate đã tồn tại. Sau khi cấp nguồn thiết bị, người dùng thử đồng bộ trên ERP; việc đọc/ghi nghiệp vụ theo lượt đồng bộ nằm ngoài kiểm thử không ghi dữ liệu của đợt setup.

## Kết quả triển khai

- URL đã kiểm tra: https://jw-zkteco-bridge-cxwygwr7wa-as.a.run.app/.
- Service `jw-zkteco-bridge`, revision `jw-zkteco-bridge-00001-b6v`, Ready=True, nhận 100% traffic. URL dạng số project do CLI cấp: https://jw-zkteco-bridge-107789134874.asia-southeast1.run.app (chưa xác minh đường dẫn `/` trên URL này).
- Image đã push: `asia-southeast1-docker.pkg.dev/jw-system-f2104/cloud-run-source-deploy/jw-zkteco-bridge:20261020-1`; index digest `sha256:ec5989e4b42c79b139721ac95e47aa179b55b8043b7dda2cec503ae3284b6380`. Digest platform mà revision chạy: `sha256:0a9a8fabf12156846a336a25fb7acbd599f14908f8836a4cc597e41969001c52`.
- Đã đối chiếu CPU 1 / 512Mi, min mặc định 0, max service/revision 1, concurrency 1, timeout 60s, CPU throttling bật, startup boost tắt, `ZK_ALLOW_WRITES=false`.
- Runtime identity `jw-zkteco-bridge@jw-system-f2104.iam.gserviceaccount.com` chỉ được cấp `secretAccessor` trên secret mới; không có binding cấp project trong project compute. `ZK_API_KEY` tham chiếu `jw-zkteco-bridge-api-key:1`, không đặt plaintext trong env YAML/image/Git. IAM public invocation bật; device routes có kiểm tra API key ở ứng dụng.
- Đã dùng đúng 5 HTTP requests: ba GET `/healthz` bị Google trả HTML 404 (hai URL dạng số project, một URL mặc định); GET `/` trên URL mặc định trả 200 với JSON health đúng; POST `/api/zkteco/device/restart` với key mới trả 403 `Device write operations are disabled.` trước khi chạy handler thiết bị. Không có restart hoặc socket thiết bị thật. Chưa xác định nguyên nhân `/healthz` bị chặn; dùng `/` cho health trên Cloud Run.
- Không còn lượt để kiểm tra missing/wrong key trên cloud trong phạm vi đã duyệt; các trường hợp này đã đạt kiểm thử offline. Tổng 9 kiểm thử offline đạt.
- Biên bản không chứa secret: `outputs/zkteco-cloud-run-deployment.json`. Bản key tạm local đã xóa sau kiểm tra; bản chính ở Secret Manager.
- Trạng thái cuối đợt triển khai bridge ban đầu: chưa test TCP/đọc máy, chưa chuyển ERP, chưa đổi DNS, chưa dừng Render. Đợt nối ERP bổ sung ở trên đã cập nhật trạng thái này: ERP được nối, đã thử đọc máy nhưng timeout. Không đọc được runtime Render; host/cổng đã được người dùng xác nhận.

## Cấu hình đã đối chiếu

- Vercel project `b.duck` (`prj_tQ4TEBV8EiEKnXYvDHfn4gAoyKTh`), team `mach-hoai-s-projects`.
- Production `ZKTECO_WORKER_URL`: https://worker.erp.joyworld.vn
- DNS CNAME: worker.erp.joyworld.vn → my-e-commerce-76m5.onrender.com.
- Production `ZK_DEVICE_ID`: store-01-zk.
- `ZKTECO_API_KEY` có trên Vercel nhưng là sensitive; API không trả lại plaintext. Không suy ra key bị mất hoặc chưa cấu hình trên production.
- `.env.local` không chứa biến bridge/ZKTeco; không ghi đè hoặc kéo toàn bộ env về file này.
- ERP source tham chiếu `bduck.fortiddns.com:4370`; DNS tại thời điểm khảo sát trả `113.171.158.41`.
- README/bridge source cũ có IP `113.171.86.171`; không dùng IP cũ để kết nối máy khi chưa xác nhận. Runtime mẫu dùng DDNS, không hardcode IP.
- Không có quyền/connector Render để đọc runtime env hiện tại. Chưa xác minh Render có override host/port/password/multi-device map hoặc mạng có allowlist IP nguồn hay không. Không kiểm tra máy thật trong giai đoạn này.

## Bản chuẩn bị local

- Dockerfile Python 3.12, user không root, một Uvicorn worker, nghe `0.0.0.0:$PORT`, timezone Việt Nam.
- Context Docker chỉ gồm main.py, requirements.txt và Dockerfile; không gửi secrets vào image.
- `/` và `/healthz` chỉ kiểm tra HTTP process, không mở socket máy.
- API máy bắt buộc X-API-Key; thiếu key/còn sample key thì fail closed.
- Khóa toàn bộ thao tác thiết bị trong một process; khi bận trả 409 thay vì mở socket thứ hai.
- Khi lỗi đọc, luôn thử bật lại UI máy và disconnect. Lỗi enable/disconnect không làm bỏ qua việc giải phóng khóa. Restart có cleanup riêng.
- `ZK_ALLOW_WRITES=false` trong cấu hình đợt thử: chặn tạo/xóa user, xóa logs, restart, đổi giờ và test giọng nói. Các tính năng ghi vẫn giữ trong source; chỉ bật nếu được yêu cầu sau.
- 9 kiểm thử offline dùng SDK giả lập đã đạt, gồm đóng socket khi connect hoặc disconnect của SDK lỗi; không kết nối Render, Firebase hoặc thiết bị thật.
- Image local `jw-zkteco-bridge:20261020-1` đã build thành công, digest `sha256:ec5989e4b42c79b139721ac95e47aa179b55b8043b7dda2cec503ae3284b6380`. Chạy cả 9 kiểm thử trong container với network=none đạt. Đã xác minh UID=10001, không có API key hoặc .env trong image. Đã push và deploy theo xác nhận người dùng.
- Script triển khai đã chạy một lần sau khi xác nhận chi phí và chuẩn bị private input files; không chạy lại nguyên script vì các tài nguyên đã tồn tại.

## Cấu hình service đã duyệt

| Hạng mục | Đề xuất |
|---|---|
| Service | jw-zkteco-bridge |
| Compute project/region | jw-system-f2104 / asia-southeast1 |
| CPU/RAM | 1 vCPU / 512 MiB |
| Scaling | min=0, max=1 ở service và revision |
| HTTP concurrency / worker | 1 / 1 |
| Timeout HTTP / TCP | 60 giây / 15 giây, cần điều chỉnh theo đo đạc |
| URL | run.app mới, chưa chuyển worker.erp.joyworld.vn |
| Auth | X-API-Key, secret riêng trong Secret Manager, pin version 1 |
| Quyền runtime | Chỉ truy cập secret riêng; không cấp Firestore/Auth/Owner/Editor |
| Artifact | Build local, push vào repository cloud-run-source-deploy hiện có |
| Chưa tạo | Scheduler, Cloud Build, Load Balancer, VPC/VPN/NAT, IP tĩnh |

## Phạm vi chi phí đã được xác nhận ngày 20/10/2026

1. Tạo service/identity/secret mới, lưu một image và chạy tối đa 5 lượt health/auth checks không mở socket thiết bị; dự trù dưới 1 USD cho lần triển khai/kiểm tra, không phải hard cap.
2. Duy trì service scale-to-zero. Nếu về sau có một request mỗi 5 phút, thời gian 5–15 giây/request, dự trù bridge khoảng 2–6 USD/tháng gồm allowance nhỏ cho image/secret/network/log, chưa gồm thuế. Nếu mỗi request kéo dài 60 giây, compute riêng có thể khoảng 13 USD/tháng trước free tier. Đây là mô hình tải giả định, không phải mức được bảo đảm.
3. Free tier dùng chung billing account, không mặc định còn quota. Không tự bật scheduled polling hoặc cron để giữ ấm.
4. Nếu thiết bị chỉ nhận IP nguồn cố định/private network, cần dự toán NAT/IP/VPN riêng và xin duyệt mới. Không tự thêm networking có phí khi kết nối lỗi.
5. Thử TCP/đọc thiết bị thật và chuyển ERP/DNS/Vercel/Firestore là đợt riêng, cần xác nhận thao tác và chi phí trước khi làm.

## Các điểm phải xử lý trước cutover

- Lấy cấu hình thực từ Render hoặc xác nhận DDNS/port/default password đang dùng. Không đưa password/API key vào chat, Git, log hoặc build args.
- Nếu không lấy được key sensitive hiện tại, có thể tạo key mới cho Cloud Run thử. Chuyển hệ thống thật sau đó phải phối hợp cập nhật key ở mọi caller, không tự đổi key Vercel đang chạy Render.
- ERP lấy `bridgeEndpoint` từ từng `attendance_devices` trước biến `ZKTECO_WORKER_URL`; chỉ đổi env URL có thể không chuyển được luồng sync. Cần duyệt cách đổi endpoint hoặc domain khi cutover, không đọc/ghi Firestore để khảo sát trước khi duyệt chi phí.
- Khóa trong Cloud Run không bảo vệ được socket khi Render vẫn kết nối cùng máy. Max instances cũng không phải khóa phân tán giữa revision/provider. Trước test máy thật cần cửa sổ bảo trì tránh polling/manual sync từ bridge cũ.
- Kiểm thử Cloud Run mới độc lập; chưa hủy Render. Sau test thiết bị và cutover thành công mới trình bước ngừng Render và cron cũ.
- Khóa ghi thiết bị vẫn tắt cho đến khi có nhu cầu rõ ràng; không thử xóa log, restart hoặc đổi giờ để kiểm chứng kết nối.

## File vận hành

- services/zkteco-bridge/runtime.env.example.yaml: mẫu non-secret, phải đối chiếu với Render; không dùng như bằng chứng cấu hình đang chạy.
- scripts/deploy-zkteco-bridge.ps1: dùng image đã build/test local, tạo secret/identity, push và deploy. Bất kỳ bước nào lỗi sẽ dừng; không tự xóa tài nguyên hoặc quay vòng key.
- Private input files phải ở vị trí gitignored. Script đọc API key từ file, không in giá trị hoặc đặt vào build args/command line. Dùng Secret Manager, không lưu key trong runtime YAML.

## Nguồn giá và runtime

- https://cloud.google.com/run/pricing
- https://cloud.google.com/secret-manager/pricing
- https://cloud.google.com/artifact-registry/pricing
- https://docs.cloud.google.com/run/docs/container-contract
- https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip
