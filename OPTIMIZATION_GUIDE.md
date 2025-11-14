# 🚀 Hướng dẫn Tối ưu hóa Chatbot Tuyển sinh

## Các tối ưu hóa đã áp dụng

### 1. ⚡ Cache Service (NEW)

**Mục đích**: Lưu trữ các câu trả lời phổ biến để giảm thời gian phản hồi

**Cách hoạt động**:

- Các câu hỏi giống nhau sẽ được cache trong bộ nhớ
- TTL (Time To Live):
  - `admission` mode: 2 giờ (dữ liệu ít thay đổi)
  - `student-support` mode: 1 giờ
  - `web-search` mode: 30 phút (dữ liệu web thay đổi nhanh)
- Cache tự động được làm mới khi hết hạn

**API Endpoints**:

```bash
# Xem thống kê cache
GET /v1/api/chat/cache-stats
Authorization: Bearer <token>

# Xóa cache (tất cả hoặc theo mode)
POST /v1/api/chat/cache/clear
Authorization: Bearer <token>
Content-Type: application/json
{
  "mode": "admission" // optional, bỏ qua để xóa tất cả
}
```

**Lợi ích**:

- ⚡ Giảm thời gian phản hồi từ 2-5s xuống < 100ms cho câu hỏi đã cache
- 💰 Tiết kiệm tài nguyên server và model
- 📊 Hit rate dự kiến: 30-50% cho các câu hỏi phổ biến

---

### 2. 🎯 Tối ưu Vector Search

**Thay đổi**:

- Giảm `k` (số documents retrieve) từ 8 xuống **5** (default)
- Chỉ tăng k khi cần:
  - Câu hỏi liệt kê ngành: k=20
  - Câu hỏi về học phí: k=10
  - Câu hỏi thông thường: k=5

**Lợi ích**:

- ⚡ Giảm 30-40% thời gian search trong FAISS index
- 🎯 Tăng độ chính xác vì chỉ lấy documents liên quan nhất
- 💾 Giảm context size gửi đến LLM

---

### 3. 🤖 Tối ưu LLM Configuration

**File**: `backend/src/config/connectModel.js`

**Thay đổi**:

```javascript
{
  temperature: 0.3,    // Tăng từ 0 -> 0.3 (cân bằng chính xác và tự nhiên)
  maxTokens: 512,      // Giới hạn độ dài response
  topP: 0.9,          // Top-p sampling
  numCtx: 2048        // Giảm context window
}
```

**Lợi ích**:

- ⚡ Giảm 20-30% thời gian generation
- 📝 Response ngắn gọn, đủ ý hơn
- 🎯 Vẫn giữ độ chính xác cao

---

### 4. 📦 Tối ưu Chunking Strategy

**File**: `backend/ingest.js`

**Thay đổi**:

- `chunkSize`: 1000 → **1500** (tăng 50%)
- `chunkOverlap`: 200 → **300** (tăng 50%)

**Lợi ích**:

- 📉 Giảm số lượng chunks → giảm kích thước FAISS index
- ⚡ Search nhanh hơn vì ít chunks hơn
- 🎯 Context liên kết tốt hơn nhờ overlap lớn hơn

**Cách áp dụng**:

```bash
# Re-ingest dữ liệu với cấu hình mới
cd backend
node ingest.js --mode admission
node ingest.js --mode student-support
```

---

### 5. 🔄 Giảm Chat History Context

**Thay đổi**:

- Chỉ load 2 tin nhắn gần nhất (thay vì toàn bộ)
- Chỉ sử dụng history khi câu hỏi có tham chiếu

**Lợi ích**:

- ⚡ Giảm context size gửi đến LLM
- 🎯 Tránh model bị phân tâm bởi lịch sử cũ
- 💾 Tiết kiệm tokens

---

## 📊 Kết quả dự kiến

| Metric                                | Trước | Sau      | Cải thiện  |
| ------------------------------------- | ----- | -------- | ---------- |
| Thời gian phản hồi (câu hỏi mới)      | 3-5s  | 2-3s     | **33-40%** |
| Thời gian phản hồi (câu hỏi đã cache) | 3-5s  | <100ms   | **>95%**   |
| Vector search time                    | 800ms | 500ms    | **37%**    |
| LLM generation time                   | 2-4s  | 1.5-2.5s | **25%**    |
| Cache hit rate                        | 0%    | 30-50%   | -          |

---

## 🛠️ Monitoring & Debugging

### 1. Kiểm tra Cache Performance

```bash
# Gọi API để xem stats
curl -X GET http://localhost:3000/v1/api/chat/cache-stats \
  -H "Authorization: Bearer <token>"
```

Response example:

```json
{
  "success": true,
  "stats": {
    "hits": 45,
    "misses": 105,
    "sets": 105,
    "totalRequests": 150,
    "hitRate": "30.00%",
    "cacheKeys": {
      "general": 0,
      "admission": 87,
      "student-support": 18,
      "web-search": 0
    }
  }
}
```

### 2. Console Logs để theo dõi

```
✅ Cache HIT: "học phí ngành công nghệ thông tin" (mode: admission)
❌ Cache MISS: "điểm chuẩn ngành luật 2025" (mode: admission)
💾 Cache SET: "điểm chuẩn ngành luật 2025" (mode: admission)
```

### 3. Clear Cache khi cần

```bash
# Clear tất cả cache
curl -X POST http://localhost:3000/v1/api/chat/cache/clear \
  -H "Authorization: Bearer <token>"

# Clear cache của một mode
curl -X POST http://localhost:3000/v1/api/chat/cache/clear \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "admission"}'
```

---

## 🔧 Tối ưu hóa thêm (Tùy chọn)

### 1. Nâng cấp Model

- Sử dụng model nhỏ hơn và nhanh hơn:
  - `llama3.1:8b-instruct-q4_K_M` (nhẹ hơn)
  - `qwen2.5:7b-instruct` (nhanh hơn)

### 2. Database Optimization

- Thêm indexes cho MongoDB:

```javascript
db.conversations.createIndex({ sessionId: 1 });
db.conversations.createIndex({ userId: 1, createdAt: -1 });
```

### 3. Connection Pooling

- Tăng kích thước connection pool trong `database.js`

### 4. Implement Load Balancing

- Sử dụng nhiều Ollama instances
- Round-robin distribution

### 5. Upgrade Hardware

- Tăng RAM cho FAISS index
- SSD cho faster disk I/O
- GPU cho Ollama (nếu có thể)

---

## 📈 Best Practices

### Khi nào nên clear cache?

- Sau khi cập nhật dữ liệu tuyển sinh (học phí, điểm chuẩn...)
- Khi phát hiện thông tin sai trong cached responses
- Định kỳ 1 tuần để làm mới

### Monitoring quan trọng

- Theo dõi hit rate (nên > 30%)
- Kiểm tra response time average
- Monitor memory usage của cache

### Development Tips

- Test với cache disabled để debug
- Log cache hits/misses trong development
- Dùng cache stats để identify popular questions

---

## 🐛 Troubleshooting

### Cache không hoạt động?

1. Check logs: Có thấy "Cache HIT/MISS" không?
2. Verify node-cache đã được install
3. Check memory limits của server

### Response vẫn chậm?

1. Check Ollama server health
2. Monitor FAISS index load time
3. Verify database connection pool
4. Check network latency

### Cache lưu sai thông tin?

1. Clear cache cho mode đó
2. Re-ingest dữ liệu nếu cần
3. Review câu prompt trong code

---

## 📞 Support

Nếu cần hỗ trợ thêm về optimization:

1. Check logs trong `backend/` folder
2. Monitor system resources (CPU, RAM, Disk)
3. Use cache-stats API để debug performance

**Happy Optimizing! 🚀**
