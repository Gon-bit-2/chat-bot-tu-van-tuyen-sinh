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

  async chat(message, sessionId = "default") {
    try {
      if (!vectorStore) {
        throw new Error("Vector Store chưa sẵn sàng.");
      }

      const retriever = vectorStore.asRetriever({
        k: 4, // Lấy 4 tài liệu liên quan nhất
      });

      const relevantDocs = await retriever.invoke(message);
      const context = formatDocumentsAsString(relevantDocs);

      console.log("--- Ngữ cảnh được truy xuất ---");
      console.log(context);
      console.log("----------------------------");

      const history = await this.loadConversation(sessionId);
      // Lấy 6 tin nhắn gần nhất để làm ngữ cảnh hội thoại
      const recentHistory = history.slice(-6);

      const promptTemplate = `
        Bạn là một trợ lý AI tư vấn tuyển sinh của trường Đại học Văn Hiến (VHU), nhiệm vụ của bạn là cung cấp thông tin chính xác, hữu ích và thân thiện cho thí sinh. Luôn luôn trả lời bằng tiếng Việt.

        **QUY TẮC XỬ LÝ:**

        1.  **ƯU TIÊN NGỮ CẢNH:**
            * Mục tiêu hàng đầu của bạn là trả lời câu hỏi của người dùng dựa trên thông tin được cung cấp trong phần "NGỮ CẢNH".
            * Khi trả lời, hãy trích dẫn thông tin trực tiếp từ ngữ cảnh, không suy diễn hoặc thêm thông tin không có trong đó.

        2.  **KHI KHÔNG CÓ NGỮ CẢNH (Hoặc ngữ cảnh không liên quan):**
            * Nếu "NGỮ CẢNH" trống hoặc không chứa thông tin trả lời cho câu hỏi, hãy hiểu rằng người dùng có thể đang hỏi một câu hỏi tư vấn chung (ví dụ: "Em là người hướng ngoại thì nên học ngành gì?", "Em thích vẽ thì có ngành nào phù hợp?").
            * Trong trường hợp này, hãy đóng vai một chuyên gia tư vấn tuyển sinh của VHU, đưa ra những gợi ý hữu ích dựa trên kiến thức chung của bạn. **Quan trọng:** Cố gắng kết nối những gợi ý đó với các ngành học thực tế đang được đào tạo tại trường Đại học Văn Hiến nếu có thể. Ví dụ, nếu người dùng thích giao tiếp, bạn có thể gợi ý ngành Quan hệ công chúng hoặc Marketing.
            * Hãy giữ giọng văn thân thiện, đưa ra lời khuyên và khuyến khích người dùng tìm hiểu thêm.

        3.  **PHƯƠNG ÁN DỰ PHÒNG:**
            * Nếu câu hỏi không liên quan đến tuyển sinh, không phù hợp, hoặc bạn hoàn toàn không thể trả lời, hãy lịch sự từ chối bằng cách nói: "Xin lỗi, tôi chưa có thông tin về vấn đề này. Bạn có thể hỏi tôi các câu hỏi khác liên quan đến tuyển sinh của trường Đại học Văn Hiến không ạ?"

        ---
        **NGỮ CẢNH:**
        ${context}
        ---

        **CÂU HỎI CỦA NGƯỜI DÙNG:** ${message}
      `;
      const systemMessageWithContext = new SystemMessage(promptTemplate);

      const messagesToInvoke = [
        systemMessageWithContext,
        new HumanMessage(message),
      ];

      // Gọi stream từ ollama
      const stream = await ollama.stream(messagesToInvoke);

      // Callback để lưu lịch sử sau khi stream kết thúc
      const saveHistoryCallback = async (aiResponseText) => {
        const userMessage = new HumanMessage(message);
        const aiMessage = new AIMessage(aiResponseText);

        // Tải lại toàn bộ lịch sử để đảm bảo tính nhất quán
        const fullHistory = await this.loadConversation(sessionId);
        fullHistory.push(userMessage, aiMessage);
        await this.saveConversation(sessionId, fullHistory);
        console.log("Đã lưu lịch sử cho sessionId:", sessionId);
      };

      return { stream, saveHistoryCallback };
    } catch (error) {
      console.error("Lỗi khi tạo stream:", error);
      throw new Error("Không thể tạo stream trả lời.");
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
