---
trigger: always_on
---

# THÔNG TIN DỰ ÁN (PROJECT OVERVIEW)
- Dự án: Hệ thống JPOS (Joy World Point of Sale) "Local-First".
- Tech Stack: Next.js 14 (App Router), Tailwind CSS, Zustand, Tauri, Firebase (Firestore, Auth, Cloud Functions).
- Ngôn ngữ giao diện (UI): Bắt buộc 100% Tiếng Việt.

# QUY TẮC KIẾN TRÚC (ARCHITECTURE RULES)
1. Sự tách biệt rạch ròi (Separation of Concerns):
   - MỌI API gọi ra bên ngoài (đặc biệt là tích hợp hệ thống Hong Kong) PHẢI nằm trong thư mục `functions/`. Không được phép rò rỉ API Key ở Frontend.
   - Các thao tác với Firestore (CRUD) phải được định nghĩa trong `src/lib/services/`. Component KHÔNG được gọi trực tiếp Firebase SDK.
   - Global State quản lý bằng Zustand đặt trong `src/lib/stores/`.
2. Ưu tiên Local-First: POS phải hoạt động mượt mà bằng cách lấy dữ liệu từ RAM (Zustand) và Firebase. Bất kỳ tiến trình nào chạy chậm phải được chuyển thành Background Job.

# QUY TẮC PHÁT TRIỂN COMPONENT (COMPONENT DEVELOPMENT RULES)
1. Nguyên tắc "Kiểm tra trước khi code" (Check Before Write):
   - TRƯỚC KHI tạo một UI Component mới (như Button, Modal, Input...), Agent PHẢI tìm kiếm trong thư mục `src/components/` xem đã có component tương tự chưa để tái sử dụng.
   - TRƯỚC KHI tạo một hàm tiện ích (Utility function), phải kiểm tra thư mục `src/lib/utils/`.
2. Giữ code đơn giản (KISS & YAGNI) - TUYỆT ĐỐI KHÔNG OVER-ENGINEERING:
   - Viết code đi thẳng vào vấn đề, dễ đọc, dễ bảo trì. 
   - Không lạm dụng Design Pattern, Generics Types hay Abstraction Layers một cách không cần thiết.
   - Chỉ giải quyết bài toán hiện tại, không viết code dự phòng cho những tính năng "có thể xảy ra trong tương lai".
3. Giới hạn độ dài: Không một file UI (Page hoặc Component) nào được vượt quá 200 dòng code. Nếu quá dài, PHẢI tách thành các sub-components nhỏ hơn.
4. Nguyên tắc Dumb & Smart Components: 
   - UI Components (Dumb) chỉ nhận `props` và render.
   - Page Components (Smart) mới chịu trách nhiệm kết nối với Zustand Store hoặc Services.

# QUY TẮC ĐẶT TÊN (NAMING CONVENTIONS)
- Components và Pages: `PascalCase` (ví dụ: `ProductCard.tsx`, `CheckoutModal.tsx`).
- Hàm logic, Hooks, Utilities: `camelCase` (ví dụ: `useCartStore.ts`, `formatCurrency.ts`).
- Các hàm giao tiếp API/Firebase phải bắt đầu bằng động từ hành động: `fetch...`, `create...`, `update...`, `delete...`.
- Interfaces và Types: Đặt trong `src/lib/types/` bằng `PascalCase` (ví dụ: `interface OrderItem`).

# QUY TẮC UI & STYLING
1. Tận dụng Context/Skills: TRƯỚC KHI thiết kế hoặc chỉnh sửa bất kỳ UI nào, BẮT BUỘC phải đọc và tuân thủ các nguyên tắc từ `@frontend-expert` và `@brand-guidelines`.
2. Styling: Dùng 100% Tailwind CSS cho styling. Tránh viết CSS thuần hoặc inline styles trừ khi xử lý animation đặc thù.
3. Bản địa hóa (Localization): Giao diện, log thông báo, placeholder bắt buộc dùng Tiếng Việt. Không dùng tiếng Anh cho UI.
4. Format: Số tiền phải được định dạng theo chuẩn Việt Nam (ví dụ: 150,000 đ).

# QUY TẮC XỬ LÝ LỖI (ERROR HANDLING)
- Các thao tác gọi Database hoặc Cloud Functions BẮT BUỘC phải bọc trong khối `try...catch`.
- Bắt được lỗi phải in ra `console.error` (để dev theo dõi) và trả về một thông báo lỗi Tiếng Việt thân thiện cho người dùng trên UI (ví dụ: "Đã có lỗi xảy ra khi tạo đơn hàng").

# QUY TẮC MONOREPO & TAURI
- Tuyệt đối tuân thủ ranh giới Monorepo (Không import chéo giữa `src/` và `functions/`).
- Frontend trong Next.js không được dùng Native Node.js Modules (`fs`, `path`) vì môi trường Tauri build bằng Static Export.

# QUY TẮC QUY TRÌNH LÀM VIỆC (WORKFLOW & COMMUNICATION RULES)
1. Bắt buộc làm rõ yêu cầu (Zero Ambiguity): Khi nhận một yêu cầu mới, Agent PHẢI sử dụng skill `@brainstorm` để phân tích. Đặt câu hỏi ngược lại cho người dùng liên tục cho đến khi mọi khía cạnh (Logic, UI/UX, Edge cases) đều rõ ràng 100% thì mới được bước sang khâu lập kế hoạch.
2. Lập kế hoạch trước khi Code (Plan Before Execution): TRƯỚC KHI viết bất kỳ dòng code nào, Agent PHẢI xuất ra một Danh sách Task (Task List) và Kế hoạch triển khai (Implementation Plan) chi tiết.
3. Cập nhật tiến độ (Track Progress): Trong suốt quá trình code, Agent phải liên tục cập nhật trạng thái của Task List (đánh dấu [x] các task đã hoàn thành).
4. Phân tích tư duy (Walkthrough/Thought Process): Bất cứ khi nào hoàn thành một module hoặc một file code quan trọng, Agent phải cung cấp một đoạn giải thích ngắn gọn về luồng tư duy (throughout) và lý do tại sao lại code như vậy để dev dễ dàng review.