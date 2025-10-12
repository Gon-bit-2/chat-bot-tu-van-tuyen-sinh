# Hướng dẫn sử dụng Chat Session tự động

## Những thay đổi đã thực hiện:

### 1. **Frontend - Chat Service cập nhật**

- ✅ Thêm `sendMessageStream()` để xử lý streaming response
- ✅ Thêm `createConversation()` để tạo session mới
- ✅ Thêm `clearHistory()` để xóa lịch sử chat
- ✅ Thêm `getHistoryLength()` để lấy độ dài lịch sử

### 2. **Frontend - ChatStream Component cập nhật**

- ✅ Sử dụng `chatService` thay vì hardcode API calls
- ✅ Tự động quản lý session ID từ localStorage
- ✅ Thêm button "Cuộc trò chuyện mới" trong header
- ✅ Auto tạo session khi cần thiết

### 3. **Backend - Controller cập nhật**

- ✅ Thêm `createConversation()` method
- ✅ Import database model
- ✅ Tạo session ID unique với timestamp và random string

### 4. **Backend - Router cập nhật**

- ✅ Thêm route `/conversation` để tạo session mới
- ✅ Thêm route `/clear` để xóa lịch sử

## Cách sử dụng:

### 1. **Tạo cuộc trò chuyện mới**

```javascript
// Tự động khi người dùng click button "Cuộc trò chuyện mới"
const data = await chatService.createConversation();
// Trả về: { success: true, sessionId: "session_1234567890_abc123", message: "..." }
```

### 2. **Gửi tin nhắn với streaming**

```javascript
// Sử dụng session ID đã có
const response = await chatService.sendMessageStream(message, sessionId);
// Trả về Response object để xử lý stream
```

### 3. **Quản lý session**

- Session ID được tự động lưu vào `localStorage`
- Tự động load session khi reload trang
- Mỗi session có ID unique: `session_${timestamp}_${randomString}`

## Lợi ích:

1. **Không cần hardcode token**: Tự động lấy từ localStorage
2. **Không cần hardcode URL**: Sử dụng proxy trong vite.config.js
3. **Quản lý session tự động**: Tạo và lưu session ID
4. **UX tốt hơn**: Button tạo cuộc trò chuyện mới
5. **Tái sử dụng code**: Sử dụng service pattern

## API Endpoints mới:

- `POST /v1/api/chat/conversation` - Tạo session mới
- `POST /v1/api/chat/clear` - Xóa lịch sử chat
- `GET /v1/api/chat/history-length/{sessionId}` - Lấy độ dài lịch sử

## Cấu trúc Session ID:

```
session_1703123456789_abc123def
│       │              │
│       │              └─ Random string (9 chars)
│       └─ Timestamp (milliseconds)
└─ Prefix "session_"
```
