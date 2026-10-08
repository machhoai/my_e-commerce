# Kế hoạch tự tạo user máy chấm công qua Render Free

Ngày cập nhật: 02/10/2026. Trạng thái: thiết kế đã cập nhật theo lựa chọn của người dùng; chưa triển khai chức năng.

## 1. Yêu cầu đã chốt

- Giữ bridge Python/FastAPI trên Render Free; không dùng Cloud Run hoặc Cloud Tasks.
- Người dùng xác nhận đang dùng Vercel Pro; sử dụng cron hiện có mỗi 5 phút để xử lý hàng đợi, không cần đổi gói hoặc thêm dịch vụ lịch chạy.
- Quản lý tạo tài khoản trên hệ thống trước; sau đó tới máy đăng ký vân tay cho user đã tạo. Không cần nhân viên có mặt khi tạo tài khoản.
- Ô chọn tạo user máy bật mặc định; lựa chọn chỉ áp dụng cho lần lưu đó. Khi thêm cửa hàng, hiển thị lại và bật mặc định.
- Tạo user trên các máy hoạt động thuộc cửa hàng trong phạm vi được gán và có chính sách MACHINE đang hiệu lực.
- Khi thêm phạm vi cửa hàng, kiểm tra user đã tồn tại trước khi tạo. Nhân viên nhiều cửa hàng vẫn chỉ có một tài khoản hệ thống.
- Người có quyền tạo tài khoản được yêu cầu tạo user máy trong phạm vi được phép quản lý; không yêu cầu thêm quyền cấu hình máy cho thao tác này.
- Lưu tài khoản/phạm vi thành công ngay, không chờ kết nối Render hoặc thiết bị.
- Giữ user máy khi nhân viên nghỉ. Khi kích hoạt lại, dùng lại user/mapping cũ; không tạo mới nếu đã có.
- Hiển thị hàng đợi và kết quả trên trang mapping; hỗ trợ thử lại và khôi phục user/mapping sau reset.
- Khôi phục vân tay/khuôn mặt không thuộc bản đầu; quản lý đăng ký lại nếu chưa có bản sao sinh trắc học.

## 2. Hiện trạng đã kiểm tra

- `app/api/auth/create-user/route.ts` tạo Firebase Auth, user, memberships và membership heads; chưa tạo user trên máy.
- `app/api/users/[uid]/workplaces/route.ts` là điểm ghi phạm vi mới. Không gắn việc tạo user máy vào các trường storeId cũ của API update-user.
- `services/zkteco-bridge/main.py` có POST `/api/zkteco/users`, gọi `set_user`; đây là thao tác có thể cập nhật user đang có nên cần lớp chống ghi đè.
- Bridge có GET `/api/zkteco/info` để đọc model, firmware và dung lượng. Chú thích GT100 trong types chưa xác nhận model thực tế. Cần truy vấn bằng môi trường có API key.
- `lib/attendance/device-sync.ts` dùng mapping theo deviceId + user_id và giữ trạng thái mapping khi đồng bộ metadata.
- `vercel.json` khai báo cron `/api/cron/attendance-sync` mỗi 5 phút, được hỗ trợ trên Vercel Pro đã được người dùng xác nhận. Cần kiểm tra CRON_SECRET và log lịch chạy thực tế để xác nhận vận hành thành công.
- Bridge chưa khóa theo thiết bị; enable_device chỉ được gọi trên nhánh thành công. Cần sửa trước khi mở tính năng ghi tự động.

## 3. Luồng lưu và hàng đợi bền vững

1. Xác thực quyền tạo tài khoản/gán phạm vi và phạm vi cửa hàng như hiện tại.
2. Lưu hồ sơ và memberships cùng yêu cầu đồng bộ trong cùng batch/transaction Firestore. Không gọi Render trong request lưu.
3. Trả kết quả tài khoản/phạm vi đã lưu, kèm thông tin đang chờ đồng bộ nếu người dùng bật ô chọn.
4. Cron đọc yêu cầu đến hạn theo thứ tự tạo; claim một yêu cầu bằng transaction và khóa chung có thời hạn. Mỗi thời điểm chỉ có một tác vụ ERP kết nối bridge.
5. Worker kiểm tra trạng thái tài khoản, phạm vi hiệu lực, thiết bị và chính sách trước khi xử lý. Phạm vi tương lai chỉ xử lý khi đến ngày hiệu lực.
6. Đối chiếu mapping và user thực tế, cấp/chọn mã cùng slot, ghi nếu cần rồi đọc lại để xác nhận.
7. Ghi mapping và trạng thái hoàn tất bằng transaction. Nếu phản hồi bị mất sau khi máy đã ghi, lần thử sau đọc lại và hoàn tất mapping thay vì cấp user mới.

Không dùng promise nền không được chờ sau khi API trả về, bộ nhớ Render, file local hay timer trong trình duyệt làm hàng đợi. Việc người dùng đóng trang hoặc Render ngủ không được làm mất yêu cầu.

### Dữ liệu đề xuất

- `attendance_provisioning_requests`: yêu cầu được lưu nguyên tử với thao tác tài khoản/phạm vi; chứa employeeUid, storeIds, actorUid, reason, createdAt, notBefore, trạng thái mở rộng thành jobs.
- `attendance_provisioning_jobs`: một job cho một employeeUid + deviceId; khóa tài liệu xác định để gộp yêu cầu lặp. Dùng generation cho lần khôi phục/thử lại có chủ đích; job DONE không tự lặp vô hạn.
- Trạng thái job: PENDING, PROCESSING, RETRY, DONE, CONFLICT, CANCELLED. Lưu attempts, nextAttemptAt, leaseOwner, leaseUntil, generation, lastErrorCode, lastErrorMessage, verifiedAt.
- `attendance_provisioning_locks`: khóa điều phối chung cho ghi user và đồng bộ máy; chỉ chủ lease hiện tại được cập nhật kết quả. Dùng thời gian máy chủ.
- `attendance_employee_codes` và bộ đếm transaction: giữ mã ổn định và quyền sở hữu mã toàn hệ thống.
- `zkteco_users`: giữ định dạng mapping hiện có, thêm nguồn auto/manual và thông tin job/kiểm chứng nếu cần.
- Audit ghi actor, account, device, mã, kết quả; không ghi API key, PIN, sinh trắc học vào log.

Request chưa mở rộng thành jobs sẽ được cron xử lý lại. Thiết bị chưa được đăng ký phải có lỗi cấu hình nhìn thấy được; không đánh dấu DONE giả khi cửa hàng MACHINE chưa có máy.

## 4. Cold start, thử lại và xử lý tuần tự

- Mỗi cron có ngân sách thời gian; không claim thêm khi không còn đủ thời gian hoàn tất tác vụ và ghi kết quả.
- Có endpoint health chỉ kiểm tra bridge, không kết nối/khóa máy. Giới hạn thời gian warm-up phù hợp Render Free, ví dụ 90 giây, sau khi đo thực tế.
- Timeout kết nối máy và đọc/ghi phải riêng với timeout warm-up. Lease dài hơn tổng thời gian tác vụ có biên an toàn; task quá hạn phải dừng và nhường cho lượt sau.
- Lỗi tạm thời dùng backoff, ví dụ 5, 10, 20, 40 phút rồi tối đa 60 phút; không xóa yêu cầu khi hết số lần thử. Ghi cảnh báo/trạng thái lâu chưa hoàn tất tại mapping.
- Ưu tiên job đến hạn cũ nhất. Job đang backoff không chặn toàn bộ cửa hàng khác; thử lại có thể xảy ra sau job mới hơn. Không hứa thứ tự hoàn tất tuyệt đối khi máy mất kết nối.
- Cron chồng lấn hoặc thao tác thử lại đồng thời không được tạo nhiều worker sở hữu cùng job.
- Bridge bổ sung khóa trên mỗi thiết bị cho TẤT CẢ thao tác đọc/ghi/info, một process worker trong giai đoạn đầu và cơ chế enable/disconnect trong finally an toàn. ERP phối hợp cả cron sync/manual sync với khóa; không chỉ khóa endpoint tạo user.
- Các request ở quá trình deploy cũ/mới và lease hết hạn cần được kiểm thử. Khóa ERP không thay thế kiểm tra trạng thái thực tế trên máy.
- Không dùng request tạo tài khoản để giữ Render thức. Hàng đợi bền vững mới là cơ chế đảm bảo yêu cầu không mất; hoàn tất phụ thuộc cron, Render và máy hoạt động trở lại.

## 5. Mã và chống tạo trùng

Đề xuất mã số toàn hệ thống cho nhân viên mới bắt đầu từ 100001; đây là giá trị thiết kế cần xác nhận bằng giới hạn thực tế trên máy. Mã không chứa số điện thoại/CCCD, không đổi khi đổi cửa hàng/nghỉ việc và không tái cấp cho người khác.

Nhân viên cũ giữ nguyên mã trong mapping hiện có, kể cả khác mã ở các máy. Không migration hàng loạt mã hoặc sinh trắc học. Lưu mã chuẩn và alias theo deviceId; không đổi user_id của user cũ chỉ để đồng nhất.

Trước khi ghi:

1. Tìm mapping của employeeUid trên deviceId; nếu nhiều mapping mâu thuẫn, báo CONFLICT.
2. Đọc users thực tế. Nếu user tương ứng còn tồn tại, dùng lại và xác nhận mapping, không ghi lại toàn bộ profile/PIN/quyền.
3. Nếu mapping có nhưng máy đã mất user, chỉ tái tạo khi mã/slot không thuộc người khác; giữ mã cũ, chọn slot rỗng nếu slot cũ đã được dùng.
4. Nếu chưa có mapping, tìm mã chuẩn/alias dành cho tài khoản. Nếu mã được dùng nhưng chưa chứng minh được quyền sở hữu, báo CONFLICT, không ghép chỉ theo tên.
5. Cấp mã bằng transaction, kiểm tra mã đã dành cho người cũ và mã thực tế trên máy đích. Nếu gặp mã ngoài hệ thống, ghi nhận xung đột/reservation và cấp lại an toàn trước lần tạo đầu tiên; không tự đổi mã đã dùng thành công ở máy khác.
6. Chọn UID nội bộ chưa dùng trên máy dưới khóa; UID khác mã nhân viên toàn hệ thống.
7. Tạo với quyền user thông thường, không sao chép quyền quản lý ERP thành quyền admin máy.
8. Đọc lại đúng mã, UID và thông tin dự kiến trước khi đánh dấu DONE.

Tên thiết bị có giới hạn 24 ký tự trong bridge và có thể giới hạn byte/encoding khác nhau theo firmware; cần thử tên tiếng Việt và quy định tên hiển thị ngắn. Tên đầy đủ trong hệ thống giữ nguyên.

## 6. Checkbox và mapping

- Form tạo tài khoản desktop/mobile/admin: checkbox bật mặc định mỗi lần mở/reset form; gửi quyết định cho lần lưu, không ghi một cờ tắt vĩnh viễn trên hồ sơ.
- Form thêm phạm vi: checkbox bật mặc định khi thêm cửa hàng; chỉ áp dụng cho phần cửa hàng mới thêm trong lần lưu. Tắt ô không hủy job đã tạo từ lần lưu trước.
- Chỉ sửa tên, hợp đồng hoặc đặt cửa hàng chính không tự sinh yêu cầu tạo user.
- Reactivate tài khoản: kiểm tra dùng lại mapping/user cũ; nếu cần phục hồi thì enqueue, không tạo trùng. Không xóa user máy khi disable/end membership.
- Mapping hiển thị cả job chưa có user trên máy, không chỉ các dòng zkteco_users hiện có. Lọc đúng phạm vi cửa hàng và quyền người xem.
- Hiển thị tài khoản, máy/cửa hàng, mã dự kiến/đã xác nhận, trạng thái, lần thử và lỗi ngắn gọn, thời điểm thử tiếp theo.
- Nút thử lại chỉ enqueue, không gọi máy trực tiếp; gộp job đang chạy, tránh người dùng bấm nhiều lần.
- Nút khôi phục sau reset enqueue các tài khoản hợp lệ trong phạm vi; dùng mapping cũ để giữ mã, không xóa logs hoặc ghi đè user khác. Khôi phục user/mapping không đồng nghĩa phục hồi vân tay.
- Text mới phải có dictionary vi/zh; phản hồi lưu tài khoản tách rõ trạng thái chờ đồng bộ.

## 7. Checklist triển khai và kiểm chứng

- [x] Chốt Render Free và không chờ bridge trong request lưu.
- [x] Chốt checkbox chỉ áp dụng lần lưu; thêm cửa hàng bật mặc định.
- [x] Xác nhận Vercel Pro hỗ trợ lịch cron mỗi 5 phút đang khai báo.
- [x] Khảo sát API tạo tài khoản, gán phạm vi, bridge và cron hiện có.
- [ ] Xác nhận model/firmware, giới hạn mã/tên và cron đang chạy thực tế.
- [ ] Thêm queue schema, reservation mã, claim/lease/backoff và audit.
- [ ] Enqueue nguyên tử trong create-user và API assign workplace; truyền tùy chọn qua các form.
- [ ] Bổ sung bridge ensure-user/readback, khóa máy và cleanup khi lỗi.
- [ ] Tích hợp cron processor, điều phối cả thao tác sync/manual sync và thu hồi lease lỗi.
- [ ] Hiển thị job tại mapping, thử lại, khôi phục; bổ sung vi/zh.
- [ ] Test queue transaction/concurrency, retry sau ghi thành công nhưng mất phản hồi, mã/slot trùng, membership tương lai/bị ngừng, account inactive/reactivate, nhiều cửa hàng và checkbox opt-out.
- [ ] Test tạo account không phụ thuộc bridge đang offline và job còn sau khi reload/deploy.
- [ ] Pilot một tài khoản kiểm thử; quản lý đăng ký vân tay và xác nhận log chấm công mapping đúng người.
- [ ] Chỉ mở rộng sau khi chạy pilot và xác nhận cron production.

## 8. Điều kiện vận hành và tài liệu

Không thay đổi hoặc deploy mã trong đợt cập nhật kế hoạch này. Không tạo/xóa user máy hay sửa dữ liệu vận hành.

- Render Free ngủ sau 15 phút không có traffic, khởi động có thể khoảng một phút: https://render.com/docs/free
- Vercel Pro hỗ trợ cron tối thiểu mỗi phút, nên lịch mỗi 5 phút hiện tại phù hợp: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Hàng đợi chỉ bảo đảm lưu yêu cầu và xử lý lại khi hạ tầng hoạt động; không bảo đảm thời gian hoàn tất khi Render/cron/máy ngừng hoạt động lâu dài.
