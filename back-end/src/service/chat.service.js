"use strict";
import { ollama } from "../config/connectModel.js";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import database from "../config/database.js";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OllamaEmbeddings } from "@langchain/ollama";
import { formatDocumentsAsString } from "langchain/util/document";

const faissStorePath = "./src/faiss_index/vhu";
const embeddings = new OllamaEmbeddings({
  model: process.env.MODEL_EMBEDDING,
  baseUrl: process.env.URL,
});
let vectorStore; // Biến để lưu trữ vector store đã tải

// Hàm tải vector store (chỉ chạy 1 lần khi server khởi động)
const loadVectorStore = async () => {
  try {
    console.log("Đang tải thư viện số từ Faiss index...");
    vectorStore = await FaissStore.load(faissStorePath, embeddings);
    console.log("✅ Thư viện số đã được tải thành công.");
  } catch (error) {
    console.error(
      "Lỗi khi tải Faiss index. Hãy chắc chắn bạn đã chạy 'node ingest.js' trước.",
      error
    );
    process.exit(1); // Dừng server nếu không tải được thư viện
  }
};
loadVectorStore();
class ChatService {
  constructor() {
    this.conversationHistory = new Map();
  }
  //convert message to db format
  messageToDbFormat(message) {
    let type = "human";
    if (message instanceof SystemMessage) type = "system";
    else if (message instanceof HumanMessage) type = "human";
    else if (message instanceof AIMessage) type = "ai";
    return {
      type,
      content: message.content,
      timestamp: message.timestamp || new Date(),
    };
  }
  dbFormatToMessage(dbMessage) {
    switch (dbMessage.type) {
      case "system":
        return new SystemMessage(dbMessage.content);
      case "human":
        return new HumanMessage(dbMessage.content);
      case "ai":
        return new AIMessage(dbMessage.content);
      default:
        return new HumanMessage(dbMessage.content);
    }
  }
  async loadConversation(sessionId) {
    try {
      let conversation = await database.conversation.findOne({ sessionId });
      if (!conversation) {
        const systemMessage = new SystemMessage(
          "Bạn là một trợ lý AI chuyên về tư vấn tuyển sinh đại học tại Việt Nam. " +
            "Hãy luôn luôn trả lời bằng tiếng Việt một cách lịch sự, rõ ràng và dễ hiểu. " +
            "Tuyệt đối không sử dụng tiếng Anh trừ khi đó là tên riêng hoặc thuật ngữ không thể dịch."
        );
        conversation = new database.conversation({
          sessionId,
          messages: [this.messageToDbFormat(systemMessage)],
        });
        await conversation.save();
      }
      //convert db format to langchain format
      return conversation.messages.map((msg) => this.dbFormatToMessage(msg));
    } catch (error) {
      console.error("Lỗi khi tải cuộc hội thoại:", error);
      return this.loadFromMemory(sessionId);
    }
  }
  async loadFromMemory(sessionId) {
    if (!this.conversationHistory.has(sessionId)) {
      const systemMessage = new SystemMessage(
        "Bạn là một trợ lý AI chuyên về tư vấn tuyển sinh đại học tại Việt Nam. " +
          "Hãy luôn luôn trả lời bằng tiếng Việt một cách lịch sự, rõ ràng và dễ hiểu. " +
          "Tuyệt đối không sử dụng tiếng Anh trừ khi đó là tên riêng hoặc thuật ngữ không thể dịch."
      );
      this.conversationHistory.set(sessionId, [systemMessage]);
    }
    return this.conversationHistory.get(sessionId);
  }
  async saveConversation(sessionId, messages) {
    try {
      const dbMessages = messages.map((msg) => this.messageToDbFormat(msg));
      await database.conversation.findOneAndUpdate(
        { sessionId },
        { messages: dbMessages, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error("Lỗi khi lưu cuộc hội thoại:", error);
      this.conversationHistory.set(sessionId, messages);
    }
  }
  async chat(message, sessionId = "default", metadata = {}) {
    try {
      if (!vectorStore) {
        throw new Error("Thư viện số (Vector Store) chưa sẵn sàng.");
      }

      const retriever = vectorStore.asRetriever(4);
      const relevantDocs = await retriever.invoke(message);
      const context = formatDocumentsAsString(relevantDocs);

      console.log("--- Ngữ cảnh được truy xuất ---");
      console.log(context);
      console.log("----------------------------");

      // **TỐI ƯU PROMPT TEMPLATE**
      const promptTemplate = `
        Bạn là một trợ lý AI tư vấn tuyển sinh của trường Đại học Văn Hiến, nhiệm vụ của bạn là cung cấp thông tin chính xác và hữu ích cho thí sinh.
        Hãy trả lời câu hỏi của người dùng một cách thân thiện, lịch sự bằng tiếng Việt.
        
        **QUY TẮC BẮT BUỘC:**
        1. CHỈ được phép trả lời dựa vào thông tin trong phần "NGỮ CẢNH" dưới đây.
        2. TUYỆT ĐỐI không được bịa đặt hoặc suy diễn thông tin không có trong ngữ cảnh.
        3. Nếu "NGỮ CẢNH" không chứa thông tin liên quan đến câu hỏi, hãy trả lời một cách lịch sự: "Xin lỗi, tôi chưa tìm thấy thông tin chính xác về vấn đề này trong tài liệu của trường. Bạn có thể hỏi về một chủ đề khác không ạ?"

        ---
        **NGỮ CẢNH:**
        ${context}
        ---

        **CÂU HỎI CỦA NGƯỜI DÙNG:** ${message}
      `;

      // Tạo một System Message duy nhất chứa toàn bộ chỉ dẫn và ngữ cảnh
      const systemMessageWithContext = new SystemMessage(promptTemplate);

      // Tải lịch sử trò chuyện
      const history = await this.loadConversation(sessionId);

      const messagesToInvoke = [
        systemMessageWithContext,
        ...history, // Thêm lịch sử vào đây để model có ngữ cảnh hội thoại
        new HumanMessage(message),
      ];

      const response = await ollama.invoke(messagesToInvoke);
      const responseText =
        response.content?.toString() ||
        "Xin lỗi, tôi đang gặp một chút sự cố và không thể trả lời lúc này.";

      console.log("--- AI Response Text ---");
      console.log(responseText);
      console.log("------------------------");

      // Lưu lại câu hỏi và câu trả lời vào lịch sử
      const userMessage = new HumanMessage(message);
      const aiMessage = new AIMessage(responseText);
      history.push(userMessage, aiMessage);
      await this.saveConversation(sessionId, history);

      return responseText;
    } catch (error) {
      console.error("Lỗi trong quá trình chat RAG:", error);
      return "Xin lỗi, đã có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.";
    }
  }

  async clearHistory(sessionId) {
    try {
      await database.conversation.findOneAndDelete({ sessionId });
      this.conversationHistory.delete(sessionId);
      return {
        success: true,
        message: "Cuộc hội thoại đã được xóa thành công.",
      };
    } catch (error) {
      console.error("Lỗi khi xóa cuộc hội thoại:", error);
      this.conversationHistory.delete(sessionId);
    }
  }
  async getHistoryLength(sessionId = "default") {
    try {
      const conversation = await database.conversation.findOne({ sessionId });
      return conversation ? conversation.messages.length : 0;
    } catch (error) {
      console.error("Error getting history length:", error);
      return this.conversationHistory.get(sessionId)?.length || 0;
    }
  }
}

const chatService = new ChatService();
export default chatService;
