---
trigger: always_on
---

# THÔNG TIN DỰ ÁN (PROJECT OVERVIEW)
- Dự án: Hệ thống Quản trị ERP (Joyworld B.Duck Cityfuns Management System).
- Tech Stack: Next.js 14 (App Router), Tailwind CSS, Firebase (Admin/Client), PWA, Playwright.
- Đặc thù UI/UX: Dự án phân tách rõ ràng giao diện Desktop và Mobile. Hỗ trợ đa ngôn ngữ (Tiếng Việt & Tiếng Trung).

# 1. QUY TẮC QUY TRÌNH LÀM VIỆC (AI WORKFLOW RULES) - BẮT BUỘC DÙNG SKILL
1. Suy nghĩ và làm rõ yêu cầu (Brainstorming & Zero Ambiguity): 
   - Khi nhận một task hoặc tính năng mới, Agent **BẮT BUỘC phải gọi skill `@brainstorm`** để phân tích sâu vấn đề.
   - Agent PHẢI chủ động đặt các câu hỏi ngược lại cho người dùng để làm rõ các edge cases (trường hợp ngoại lệ), logic nghiệp vụ và luồng UI/UX trước khi bắt đầu lập kế hoạch. KHÔNG được tự ý đoán mò hay giả định.
2. Kế hoạch trước khi Code (Plan Before Execution): 
   - Chỉ khi mọi yêu cầu đã rõ ràng 100%, Agent mới được xuất ra một Danh sách Task (Task List) và Kế hoạch triển khai chi tiết. Liên tục cập nhật tiến độ `[x]` trong quá trình làm việc.
3. Giải thích tư duy (Thought Process): 
   - Bất cứ khi nào hoàn thành một module quan trọng, Agent phải cung cấp một đoạn giải thích ngắn gọn về luồng tư duy và lý do tại sao lại code như vậy để dev dễ dàng review.

# 2. QUY TẮC UI & STYLING (UI & STYLING RULES) - BẮT BUỘC DÙNG SKILL
1. Tận dụng Chuyên gia UI (Use Frontend Skills): 
   - TRƯỚC KHI thiết kế hoặc chỉnh sửa bất kỳ UI nào, Agent **BẮT BUỘC phải sử dụng skill `@frontend-expert`** để đảm bảo giao diện đẹp, hiện đại, chuẩn UX và đồng bộ với hệ thống. 
   - Nếu UI liên quan đến thiết kế dashboard hoặc nhận diện thương hiệu, phải tham khảo thêm `@kpi-dashboard-design` và `@brand-guidelines`.
2. Đa ngôn ngữ (i18n):
   - KHÔNG hardcode text tĩnh trực tiếp vào giao diện. Mọi text trên UI bắt buộc phải sử dụng hệ thống dictionary trong `lib/i18n/`.
3. Styling:
   - Sử dụng 100% Tailwind CSS. Tuyệt đối không viết CSS thuần hoặc inline-style trừ phi xử lý animation đặc thù.

# 3. QUY TẮC PHÁT TRIỂN COMPONENT (COMPONENT DEVELOPMENT RULES)
1. Giới hạn độ dài tuyệt đối (Strict Length Limit): 
   - **KHÔNG MỘT FILE UI NÀO (Page hoặc Component) được vượt quá 200 dòng code.** - Nếu file có dấu hiệu phình to, BẮT BUỘC phải dừng lại, refactor và tách thành các sub-components nhỏ hơn. Không có ngoại lệ.
2. Nguyên tắc "Kiểm tra trước khi code" (Check Before Write):
   - BẮT BUỘC tìm kiếm trong `components/ui/` và `components/shared/` xem đã có component nào phục vụ mục đích tương tự chưa để tái sử dụng, tránh code trùng lặp (DRY).
   - Component UI (Dumb) chỉ nhận props và render. Page (Smart) mới gọi Actions/Services.

# 4. QUY TẮC KIẾN TRÚC & ROUTING (ARCHITECTURE RULES)
1. Sự tách biệt Nền tảng (Platform Separation):
   - Tuyệt đối tuân thủ ranh giới giữa `app/desktop/` và `app/mobile/`. Component của nền tảng này không được dùng cho nền tảng kia trừ khi chúng nằm trong thư mục shared/ui.
2. Tách biệt Logic & UI:
   - MỌI API Routes phải đặt trong `app/api/` và phân nhóm theo domain.
   - Tương tác với Firebase DB/Services phải đi qua các file dịch vụ chuyên biệt trong `lib/` (ví dụ: `lib/inventory-services.ts`). KHÔNG gọi trực tiếp Firebase Client SDK bên trong UI Components.

# 5. QUY TẮC TƯƠNG TÁC, XỬ LÝ LỖI & THÔNG BÁO (INTERACTION & NOTIFICATION)
1. Phản hồi trực quan bắt buộc (Mandatory Visual Feedback):
   - MỌI thao tác thay đổi dữ liệu (Submit, Delete, Update...) BẮT BUỘC phải đi kèm hiệu ứng thay đổi trạng thái (ví dụ: `disabled` button, hiển thị `loading spinner` trong lúc chờ xử lý) để người dùng biết hệ thống đang phản hồi.
   - Luôn có hiệu ứng kết thúc (transition/animation) rõ ràng khi hoàn thành một tiến trình.
2. Hệ thống Toast thông báo (Gooey Toast):
   - BẮT BUỘC sử dụng thư viện `goey-toast` để thông báo kết quả cuối cùng cho người dùng (Thành công, Thất bại, hoặc Cảnh báo).
   - Đảm bảo Root Layout hoặc Provider đã bọc `<GooeyToaster position="top-right" />`.
   - **Cú pháp chuẩn cho thao tác cơ bản:**
     ```typescript
     gooeyToast.success('Tiêu đề thông báo bằng i18n', {
       description: 'Chi tiết thông báo đã được dịch...',
       preset: 'snappy',
       timing: { displayDuration: 6000 },
     })
     ```
   - **Cú pháp chuẩn cho thao tác bất đồng bộ (API/Database):** Ưu tiên sử dụng `gooeyToast.promise` để gom chung trạng thái loading và kết quả. BẮT BUỘC cung cấp đầy đủ Title, Description (cho cả success/error) và action Retry nếu lỗi:
     ```typescript
     gooeyToast.promise(saveDataAction(), {
       loading: 'Đang lưu dữ liệu...', // Dùng i18n
       success: 'Đã lưu thay đổi',
       error: 'Đã xảy ra lỗi',
       description: {
         success: 'Tất cả thay đổi đã được đồng bộ thành công.',
         error: 'Vui lòng thử lại sau hoặc liên hệ quản trị viên.',
       },
       action: {
         error: {
           label: 'Thử lại',
           onClick: () => retryAction(),
         },
       },
     })
     ```
3. Xử lý lỗi (Error Handling):
   - Các thao tác gọi API/Database BẮT BUỘC phải bọc trong `try...catch`.
   - Bắt được lỗi phải in ra `console.error` (cho dev) và gọi `gooeyToast.error(...)` (hoặc thông qua `.promise()`) để hiển thị lỗi cho người dùng bằng đa ngôn ngữ.

# 6. QUY TẮC ĐẶT TÊN (NAMING CONVENTIONS)
1. Naming: Component/Page dùng `PascalCase`. Hàm logic/Hooks dùng `camelCase`. API Fetching bắt đầu bằng động từ hành động (`fetch...`, `update...`).