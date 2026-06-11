---
trigger: always_on
---

# QUY TẮC MONOREPO & IMPORT (MONOREPO & ALIAS RULES)
1. Ranh giới dự án (Workspace Boundaries): 
   - Dự án Frontend (Next.js) nằm ở root `src/`.
   - Dự án Backend (Cloud Functions) nằm ở `functions/src/`.
   - TUYỆT ĐỐI KHÔNG import chéo file giữa 2 khu vực này (Ví dụ: Frontend không được import các hàm utility của thư mục functions).
2. Đường dẫn tuyệt đối (Absolute Imports):
   - Luôn sử dụng alias `@/` khi import trong Next.js (VD: `import { Button } from '@/components/ui/Button'`). Cấm sử dụng đường dẫn tương đối dài dòng như `../../../components/`.

# QUY TẮC TAURI & PHẦN CỨNG (TAURI & HARDWARE IPC)
1. Giao tiếp với OS: Vì Frontend chạy trong môi trường Tauri (Desktop), khi cần tương tác với hệ điều hành, máy in, hoặc máy quét mã vạch, BẮT BUỘC phải dùng `@tauri-apps/api`.
2. Không dùng Node.js Native: TUYỆT ĐỐI KHÔNG sử dụng các module native của Node.js (như `fs`, `path`, `child_process`) bên trong thư mục `src/` của Next.js vì nó sẽ gây lỗi khi Tauri build tĩnh (Static Export).

# QUY TẮC QUẢN LÝ STATE (ZUSTAND RULES)
1. Bất biến (Immutability): Không bao giờ được thay đổi (mutate) state trực tiếp. Luôn trả về một object/array mới khi update state trong Zustand.
2. Tách biệt Store: Không nhồi nhét mọi thứ vào một file store. Phân tách rõ ràng: `useAuthStore`, `useCartStore`, `useProductStore`.

# QUY TẮC OFFLINE-FIRST & ĐỒNG BỘ (OFFLINE & SYNC RULES)
1. Xử lý mất mạng (Network Drop): Các thao tác bán hàng/thêm giỏ hàng tuyệt đối không được block (chặn) UI chờ API. Luôn cập nhật UI ngay lập tức (Optimistic UI), lưu xuống Firestore cục bộ, rồi mới để Background Worker lo việc đồng bộ.
2. Trạng thái Loading: Mọi thao tác cần chờ đợi (như đăng nhập, quét mã QR thanh toán) phải có trạng thái `isLoading` và hiển thị Skeleton rõ ràng trên UI.

# QUY TẮC BẢO MẬT & LOG (SECURITY & LOGGING)
1. Dọn dẹp Log: Cấm sử dụng `console.log` để in ra các dữ liệu nhạy cảm (thông tin khách hàng, số dư tài khoản, API Key) lên màn hình console của trình duyệt.
2. Môi trường (Environment): Chỉ được phép gọi `process.env` chứa tiền tố `NEXT_PUBLIC_` ở Frontend. Các biến môi trường khác chỉ được dùng ở thư mục `functions/`.