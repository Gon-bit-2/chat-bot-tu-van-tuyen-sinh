"use strict";
import { ollama } from "../config/connectModel.js";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import database from "../config/database.js";
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
      //load conversation from memory
      const history = await this.loadConversation(sessionId);
      //add user message
      const userMessage = new HumanMessage(message);
      history.push(userMessage);
      console.log("message", message);
      console.log("conversation history", history.length);
      //get ai response
      const response = await ollama.invoke(history);
      console.log("response", response);
      const responseText =
        response.content || response.text || response.toString();
      //add ai message to history
      const aiMessage = new AIMessage(responseText);
      history.push(aiMessage);
      //save conversation
      await this.saveConversation(sessionId, history);
      return responseText;
    } catch (error) {
      console.error("Lỗi khi gọi Ollama:", error);
      return "Xin lỗi, tôi không thể trả lời câu hỏi này lúc này.";
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
