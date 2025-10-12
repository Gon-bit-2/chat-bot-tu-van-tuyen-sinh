# Test Session Management

## Kiểm tra các chức năng đã implement:

### 1. **Frontend - Chat Service**

- ✅ `sendMessageStream()` - Gửi tin nhắn với streaming
- ✅ `createConversation()` - Tạo session mới
- ✅ `clearHistory()` - Xóa lịch sử chat
- ✅ `getHistoryLength()` - Lấy độ dài lịch sử

### 2. **Frontend - ChatStream Component**

- ✅ Import `@services/chat.service` (đã fix alias)
- ✅ State management cho `sessionId`
- ✅ Button "Cuộc trò chuyện mới" trong header
- ✅ Auto tạo session khi cần
- ✅ Lưu/load session từ localStorage

### 3. **Backend - Controller**

- ✅ `createConversation()` method
- ✅ Import database model
- ✅ Tạo session ID unique

### 4. **Backend - Router**

- ✅ Route `POST /conversation`
- ✅ Route `POST /clear`

### 5. **Vite Config**

- ✅ Cấu hình alias cho `@services/*`
- ✅ Proxy cho API calls

## Cách test:

1. **Mở http://localhost:3001**
2. **Kiểm tra button "Cuộc trò chuyện mới"** - Click để tạo session mới
3. **Gửi tin nhắn** - Kiểm tra streaming response
4. **Reload trang** - Kiểm tra session được lưu trong localStorage
5. **Kiểm tra Network tab** - Xem API calls không còn hardcode

## Expected Results:

- ✅ Không còn lỗi import `@services/chat.service`
- ✅ Button "Cuộc trò chuyện mới" hoạt động
- ✅ Session ID được tạo tự động
- ✅ Token được lấy từ localStorage
- ✅ API calls sử dụng proxy `/v1/api`
- ✅ Streaming response hoạt động bình thường

## Session ID Format:

```
session_1703123456789_abc123def
```

## API Endpoints:

- `POST /v1/api/chat/conversation` ✅
- `POST /v1/api/chat/clear` ✅
- `POST /v1/api/chat` ✅
