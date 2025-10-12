# 📚 Chat Service Documentation

## 🎯 Tổng quan

Chat Service là một dịch vụ AI chatbot chuyên về tư vấn tuyển sinh đại học, được xây dựng để cung cấp thông tin chính xác và hữu ích cho thí sinh quan tâm đến trường Đại học Văn Hiến (VHU).

## 🛠️ Công nghệ sử dụng

### Core Technologies

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database lưu trữ cuộc hội thoại
- **Mongoose** - ODM cho MongoDB

### AI & Machine Learning

- **Ollama** - Local LLM server
- **LangChain** - Framework cho AI applications
- **FAISS** - Vector database cho semantic search
- **OllamaEmbeddings** - Text embeddings

### Vector Search & RAG

- **FAISS Store** - Vector storage và retrieval
- **Document Retrieval** - Tìm kiếm tài liệu liên quan
- **Context Injection** - Chèn ngữ cảnh vào prompt

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Chat Service  │    │   AI Model      │
│   (Client)      │◄──►│   (Backend)     │◄──►│   (Ollama)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   MongoDB       │
                       │   (Database)    │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   FAISS Index   │
                       │   (Vector DB)   │
                       └─────────────────┘
```

## 📋 Các hoạt động chính của Service

### 1. **Khởi tạo và Cấu hình**

```javascript
// Tải vector store từ FAISS index
const loadVectorStore = async () => {
  vectorStore = await FaissStore.load(faissStorePath, embeddings);
};
```

**Chức năng:**

- Khởi tạo kết nối với Ollama server
- Tải FAISS vector store chứa embeddings của tài liệu
- Cấu hình embeddings model
- Xử lý lỗi khi không tải được vector store

### 2. **Quản lý Cuộc hội thoại (Conversation Management)**

#### a) **Tải lịch sử hội thoại**

```javascript
async loadConversation(sessionId) {
  // Tải từ database hoặc memory
  // Tạo system message mặc định
  // Chuyển đổi format giữa DB và LangChain
}
```

**Chức năng:**

- Tải lịch sử hội thoại từ MongoDB
- Fallback về memory nếu database lỗi
- Tạo system message mặc định cho session mới
- Chuyển đổi format giữa database và LangChain messages

#### b) **Lưu trữ cuộc hội thoại**

```javascript
async saveConversation(sessionId, messages) {
  // Lưu vào database
  // Fallback về memory nếu lỗi
}
```

**Chức năng:**

- Lưu cuộc hội thoại vào MongoDB
- Cập nhật timestamp
- Fallback về memory storage
- Xử lý lỗi database

### 3. **Xử lý Chat (Core Chat Processing)**

#### a) **Retrieval-Augmented Generation (RAG)**

```javascript
// Tìm kiếm tài liệu liên quan
const retriever = vectorStore.asRetriever({ k: 4 });
const relevantDocs = await retriever.invoke(message);
const context = formatDocumentsAsString(relevantDocs);
```

**Quy trình:**

1. **Vector Search**: Tìm 4 tài liệu liên quan nhất
2. **Context Extraction**: Trích xuất ngữ cảnh từ tài liệu
3. **Prompt Engineering**: Tạo prompt với ngữ cảnh
4. **AI Generation**: Gọi Ollama để tạo phản hồi

#### b) **Prompt Template**

```javascript
const promptTemplate = `
Bạn là trợ lý AI tư vấn tuyển sinh của trường Đại học Văn Hiến...

**QUY TẮC XỬ LÝ:**
1. ƯU TIÊN NGỮ CẢNH: Trả lời dựa trên thông tin được cung cấp
2. KHI KHÔNG CÓ NGỮ CẢNH: Tư vấn chung dựa trên kiến thức
3. PHƯƠNG ÁN DỰ PHÒNG: Từ chối lịch sự nếu không liên quan

**NGỮ CẢNH:** ${context}
**CÂU HỎI:** ${message}
`;
```

### 4. **Streaming Response**

```javascript
const stream = await ollama.stream(messagesToInvoke);
return { stream, saveHistoryCallback };
```

**Chức năng:**

- Streaming response từ Ollama
- Callback để lưu lịch sử sau khi stream kết thúc
- Xử lý real-time response

### 5. **Quản lý Session**

#### a) **Xóa lịch sử**

```javascript
async clearHistory(sessionId) {
  // Xóa từ database
  // Xóa từ memory
  // Trả về kết quả
}
```

#### b) **Kiểm tra độ dài lịch sử**

```javascript
async getHistoryLength(sessionId) {
  // Đếm số message trong session
  // Fallback về memory nếu database lỗi
}
```

## 🔄 Luồng xử lý (Processing Flow)

### 1. **Nhận Request**

```
Client Request → Chat Controller → Chat Service
```

### 2. **Xử lý Message**

```
1. Load Conversation History
2. Vector Search (RAG)
3. Context Extraction
4. Prompt Engineering
5. AI Generation (Ollama)
6. Stream Response
7. Save History
```

### 3. **Response Flow**

```
Ollama Stream → Client → Save to Database
```

## 📊 Data Models

### Conversation Model

```javascript
{
  sessionId: String,
  messages: [{
    type: "system" | "human" | "ai",
    content: String,
    timestamp: Date
  }],
  updatedAt: Date
}
```

### Message Types

- **SystemMessage**: System prompt và instructions
- **HumanMessage**: Câu hỏi từ người dùng
- **AIMessage**: Phản hồi từ AI

## 🔧 Cấu hình Environment

### Required Environment Variables

```env
# Ollama Configuration
URL=http://localhost:11434
MODEL=llama3.2
MODEL_EMBEDDING=nomic-embed-text

# Database
MONGODB_URI=mongodb://localhost:27017/chatbot-tuyensinh
```

## 🚀 Cách sử dụng

### 1. **Khởi tạo Service**

```javascript
import chatService from "./src/service/chat.service.js";

// Service tự động khởi tạo khi import
```

### 2. **Gửi Message**

```javascript
const { stream, saveHistoryCallback } = await chatService.chat(
  "Em muốn tìm hiểu về ngành Công nghệ thông tin",
  "session-123"
);

// Xử lý stream response
for await (const chunk of stream) {
  console.log(chunk.content);
}

// Lưu lịch sử
await saveHistoryCallback();
```

### 3. **Quản lý Session**

```javascript
// Xóa lịch sử
await chatService.clearHistory("session-123");

// Kiểm tra độ dài lịch sử
const length = await chatService.getHistoryLength("session-123");
```

## 🔍 Vector Search & RAG

### FAISS Index Structure

```
src/faiss_index/vhu/
├── faiss.index      # Vector index
└── docstore.json    # Document metadata
```

### Document Processing

1. **Ingestion**: Xử lý tài liệu PDF/TXT
2. **Chunking**: Chia nhỏ tài liệu
3. **Embedding**: Tạo vector embeddings
4. **Indexing**: Lưu vào FAISS index

### Retrieval Process

1. **Query Embedding**: Tạo embedding cho câu hỏi
2. **Similarity Search**: Tìm tài liệu tương tự
3. **Context Assembly**: Ghép ngữ cảnh
4. **Response Generation**: Tạo phản hồi

## 🛡️ Error Handling

### Database Errors

- Fallback về memory storage
- Logging lỗi chi tiết
- Graceful degradation

### Vector Store Errors

- Kiểm tra FAISS index tồn tại
- Exit process nếu không tải được
- Hướng dẫn chạy ingest script

### AI Model Errors

- Retry mechanism
- Error logging
- User-friendly error messages

## 📈 Performance Optimization

### Memory Management

- Lazy loading vector store
- Session-based conversation storage
- Memory cleanup cho unused sessions

### Database Optimization

- Index trên sessionId
- Upsert operations
- Connection pooling

### AI Performance

- Streaming responses
- Context window management
- Efficient prompt engineering

## 🔧 Maintenance

### Regular Tasks

1. **Backup FAISS index**
2. **Monitor database size**
3. **Update AI models**
4. **Update documents**

### Monitoring

- Database connection status
- Vector store health
- AI model performance
- Memory usage

## 🚨 Troubleshooting

### Common Issues

1. **Vector Store not loaded**: Chạy `node ingest.js`
2. **Database connection failed**: Kiểm tra MongoDB
3. **Ollama not responding**: Kiểm tra Ollama server
4. **Memory issues**: Restart service

### Debug Commands

```bash
# Kiểm tra Ollama
curl http://localhost:11434/api/tags

# Kiểm tra MongoDB
mongosh mongodb://localhost:27017/chatbot-tuyensinh

# Kiểm tra FAISS index
ls -la src/faiss_index/vhu/
```

## 📝 Best Practices

### Development

- Sử dụng sessionId unique
- Handle errors gracefully
- Log important operations
- Test với various inputs

### Production

- Monitor memory usage
- Regular database cleanup
- Backup vector store
- Update AI models

### Security

- Validate input
- Sanitize user messages
- Rate limiting
- Session management

---

## 📞 Support

Để được hỗ trợ hoặc báo cáo lỗi, vui lòng liên hệ team phát triển hoặc tạo issue trong repository.

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintainer**: Development Team
