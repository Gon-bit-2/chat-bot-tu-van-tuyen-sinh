# Hướng Dẫn Tổ Chức Dữ Liệu

## Cấu Trúc Thư Mục

### 1. `/admission` - Dữ liệu Tư Vấn Tuyển Sinh

Chứa tất cả tài liệu liên quan đến tuyển sinh, xét tuyển, học phí, học bổng:

**Các file nên đặt trong thư mục này:**

- Chính sách học phí và học bổng
- Hồ sơ dự tuyển
- Quy trình xét tuyển
- Thông tin các ngành học (mã ngành, điểm chuẩn, tổ hợp môn)
- Phương thức tuyển sinh
- Tuyển sinh liên thông

**Ví dụ từ thư mục cũ `vhu/`:**

```
- chính sách học phí và học bổng dành cho thí sinh nhập học đại học chính quy.txt
- CHÍNH SÁCH HỌC PHÍ VÀ HỌC BỔNG TRƯỜ.txt
- hồ sơ dự tuyển đại học chính quy.txt
- Quy Trình Xét Tuyển Vào Học.txt
- Tên ngành *.txt (tất cả file về ngành học)
- Tuyển Sinh Liên Thông Từ Trung Cấp, Cao Đẳng Lên Đại Học.txt
```

### 2. `/student-support` - Dữ liệu Hỗ Trợ Sinh Viên

Chứa tài liệu hỗ trợ sinh viên đang học tại trường:

**Các file nên đặt trong thư mục này:**

- Thông tin về trường (cơ sở vật chất, địa điểm)
- Quy chế đào tạo
- Lịch học, lịch thi
- Thủ tục hành chính
- Các dịch vụ sinh viên
- Câu lạc bộ, hoạt động ngoại khóa

**Ví dụ từ thư mục cũ `vhu/`:**

```
- Nghiên cứu Đại học Văn Hiến (VHU).txt
- Trường Đại học Văn Hiến có trụ sở t.txt
```

### 3. `/general` - Dữ liệu Chung (Tùy chọn)

Chứa thông tin chung có thể dùng cho cả hai mode:

- Thông tin tổng quan về trường
- Lịch sử hình thành
- Thành tích, giải thưởng

## Cách Phân Loại Dữ Liệu

### Câu hỏi hướng dẫn:

1. **Đối tượng là ai?**

   - Thí sinh chưa vào trường → `admission/`
   - Sinh viên đang học → `student-support/`

2. **Nội dung về gì?**
   - Tuyển sinh, xét tuyển, học phí → `admission/`
   - Học tập, sinh hoạt, thủ tục → `student-support/`

## Lưu Ý

- Một file có thể được copy vào cả 2 thư mục nếu phù hợp với cả 2 mục đích
- Đặt tên file rõ ràng, có dấu
- Sử dụng file .txt hoặc .pdf

## Sau Khi Phân Loại

Chạy lệnh để tạo FAISS index cho từng mode:

```bash
node ingest.js --mode admission
node ingest.js --mode student-support
```

Hoặc tạo tất cả:

```bash
node ingest.js --mode all
```
