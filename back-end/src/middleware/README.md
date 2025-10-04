# Authentication Middleware

## Tổng quan

Middleware authentication được sử dụng để bảo vệ các route cần xác thực người dùng.

## Cách sử dụng

### 1. Middleware bắt buộc (requireAuth)

Sử dụng khi route yêu cầu người dùng phải đăng nhập:

```javascript
import { requireAuth } from "../middleware/auth.middleware.js";

// Áp dụng cho tất cả route trong router
router.use(requireAuth);

// Hoặc áp dụng cho route cụ thể
router.post("/protected-route", requireAuth, controller.handler);
```

### 2. Middleware tùy chọn (optionalAuth)

Sử dụng khi route có thể hoạt động với hoặc không có token:

```javascript
import { optionalAuth } from "../middleware/auth.middleware.js";

router.get("/public-route", optionalAuth, controller.handler);
```

## Cách gửi token từ client

### Header Authorization

```
Authorization: Bearer <your-access-token>
```

### Ví dụ với axios

```javascript
const response = await axios.post("/v1/api/chat", data, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

## Response khi lỗi

### Không có token

```json
{
  "success": false,
  "message": "Access token is required"
}
```

### Token không hợp lệ

```json
{
  "success": false,
  "message": "Invalid token"
}
```

### Token hết hạn

```json
{
  "success": false,
  "message": "Token has expired"
}
```

## Thông tin user trong request

Sau khi xác thực thành công, thông tin user sẽ được lưu trong `req.user` và `req.keyStore`:

```javascript
// Trong controller
const userId = req.user.userId;
const email = req.user.email;
const keyStore = req.keyStore; // Chứa thông tin về publicKey, privateKey, refreshToken
```

## Cách hoạt động

1. **Tạo token**: Khi user đăng nhập, hệ thống tạo `publicKey` và `privateKey` ngẫu nhiên
2. **Lưu keys**: `publicKey` và `privateKey` được lưu vào database cùng với `userId`
3. **Verify token**: Khi verify token, hệ thống:
   - Decode token để lấy `userId`
   - Tìm `publicKey` tương ứng trong database
   - Verify token với `publicKey` đó
