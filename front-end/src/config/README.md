# Axios Configuration

File này cấu hình axios để kết nối với backend API.

## Tính năng

- ✅ **Base URL**: Tự động cấu hình URL API
- ✅ **Timeout**: 10 giây timeout cho mỗi request
- ✅ **Headers**: Tự động thêm Content-Type và Accept
- ✅ **Token Management**: Tự động thêm Bearer token vào header
- ✅ **Request/Response Interceptors**: Xử lý tự động
- ✅ **Error Handling**: Xử lý lỗi HTTP phổ biến
- ✅ **Logging**: Log request/response trong development
- ✅ **File Upload**: Hỗ trợ upload file với progress

## Cách sử dụng

### 1. Import axios config

```javascript
import { api } from "../config/axios";
// hoặc
import axiosConfig from "../config/axios";
```

### 2. Sử dụng API helpers

```javascript
// GET request
const response = await api.get("/users");

// POST request
const response = await api.post("/auth/login", {
  email: "user@example.com",
  password: "password123",
});

// PUT request
const response = await api.put("/users/1", userData);

// DELETE request
const response = await api.delete("/users/1");

// Upload file
const response = await api.upload("/upload", formData, (progress) => {
  console.log(`Upload progress: ${progress}%`);
});
```

### 3. Sử dụng Service

```javascript
import { authService } from "../services/authService";

// Đăng nhập
const result = await authService.login({
  email: "user@example.com",
  password: "password123",
});

// Đăng ký
const result = await authService.register({
  name: "John Doe",
  email: "user@example.com",
  password: "password123",
});
```

### 4. Xử lý lỗi

```javascript
try {
  const response = await api.post("/auth/login", credentials);
  // Xử lý thành công
} catch (error) {
  if (error.response) {
    // Lỗi từ server
    console.error("Server Error:", error.response.data.message);
  } else if (error.request) {
    // Lỗi network
    console.error("Network Error:", error.message);
  } else {
    // Lỗi khác
    console.error("Error:", error.message);
  }
}
```

## Cấu hình

### Environment Variables

Tạo file `.env` trong thư mục `front-end`:

```env
VITE_API_URL=http://localhost:3000
```

### Vite Proxy

File `vite.config.js` đã được cấu hình proxy:

```javascript
export default defineConfig({
  server: {
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```

## Token Management

- Token được tự động lưu vào `localStorage`
- Tự động thêm vào header `Authorization: Bearer <token>`
- Tự động xóa token khi gặp lỗi 401
- Tự động chuyển hướng đến trang login khi token hết hạn

## Error Handling

- **401**: Tự động xóa token và chuyển hướng đến login
- **403**: Log lỗi không có quyền truy cập
- **404**: Log lỗi không tìm thấy resource
- **500**: Log lỗi server
- **Network Error**: Log lỗi kết nối

## Development

Trong development mode, tất cả request và response sẽ được log ra console để debug.
