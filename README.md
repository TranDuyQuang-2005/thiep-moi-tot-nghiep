# Thiệp mời tốt nghiệp

Trang Next.js triển khai trên Vercel. Thiệp dùng bố cục cuộn dọc gồm lời mời, lịch, đếm ngược theo giờ Việt Nam, bản đồ, xác nhận tham dự và lời chúc. Sau khi tạo dự án, kết nối Vercel Blob dạng **Private** ở mục Storage và chọn môi trường Production. Link thiệp dùng `/i/<mã>` và được lưu trong Blob; phản hồi khách mời cũng được lưu trong cùng Blob store. Các thiệp đã tạo trên dự án này vẫn mở bằng đường dẫn cũ và hiển thị theo bố cục mới sau khi cập nhật dự án hiện tại.

`npm install` và `npm run build` kiểm tra dự án trước khi xuất bản.
