"use strict";
import chatService from "../service/chat.service.js";
import database from "../config/database.js";

class ChatController {
  async chat(req, res) {
    try {
      const { message, sessionId, mode } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Validate mode (nếu có)
      const validModes = ["admission", "student-support", "web-search"];
      const selectedMode = mode || "admission"; // Mặc định là admission

      if (!validModes.includes(selectedMode)) {
        return res.status(400).json({
          error: `Mode không hợp lệ. Các mode hợp lệ: ${validModes.join(", ")}`,
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      console.log(
        `📩 Nhận tin nhắn: "${message}" từ session: ${sessionId}, mode: ${selectedMode}`
      );

      // ✅ Set metadata trước khi xử lý chat (chỉ lần đầu)
      const userId = req.user?.userId; // Từ auth middleware
      const userAgent = req.get("User-Agent");
      const ipAddress = req.ip || req.connection.remoteAddress;

      chatService.setSessionMetadata(sessionId, {
        userId,
        userAgent,
        ipAddress,
      });

      const result = await chatService.chat(message, sessionId, selectedMode);
      const stream = result.stream;
      const saveHistoryCallback = result.saveHistoryCallback;
      const usedGoogle = result.usedGoogle || false;

      let fullResponse = "";
      let chunkCount = 0;

      // Stream từng chunk
      for await (const chunk of stream) {
        chunkCount++;
        fullResponse += chunk;

        console.log(`📤 Chunk ${chunkCount}:`, chunk);

        res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);

        if (res.flush) res.flush();
      }

      console.log(
        `✅ Stream hoàn tất. Mode: ${selectedMode}, Đã dùng Google: ${usedGoogle}`
      );

      await saveHistoryCallback(fullResponse);

      // ✅ SỬA: Gửi signal riêng, không phải text
      res.write("data:\n\n");
      res.end();
    } catch (error) {
      console.error("❌ Error in chat:", error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
  async createConversation(req, res) {
    try {
      // Chỉ tạo sessionId, KHÔNG lưu vào database
      // Database sẽ tự động tạo khi có message đầu tiên
      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      res.json({
        success: true,
        sessionId,
        message:
          "Session ID đã được tạo. Conversation sẽ được lưu khi có message đầu tiên.",
      });
    } catch (error) {
      console.error("Lỗi khi tạo session:", error);
      res.status(500).json({ error: "Lỗi máy chủ nội bộ." });
    }
  }

  async clearHistory(req, res) {
    const { sessionId } = req.body;
    const result = await chatService.clearHistory(sessionId || "default");
    res.json({
      success: result.success,
      message: result.message,
    });
  }

  async getHistory(req, res) {
    try {
      const { sessionId } = req.params;
      const history = await chatService.loadConversation(sessionId);

      res.json({
        success: true,
        sessionId: sessionId,
        messages: history.map((msg) => ({
          role: msg._getType() === "human" ? "user" : "assistant",
          content: msg.content,
        })),
      });
    } catch (error) {
      console.error("Lỗi khi lấy lịch sử:", error);
      res.status(500).json({ error: "Lỗi máy chủ nội bộ." });
    }
  }

  /**
   * GET /chat/modes
   * Trả về danh sách các mode khả dụng cho frontend
   */
  async getModes(req, res) {
    try {
      const modes = await chatService.getAvailableModes();

      res.json({
        success: true,
        modes: modes,
        total: modes.length,
      });
    } catch (error) {
      console.error("❌ Lỗi khi lấy danh sách modes:", error);
      res.status(500).json({
        success: false,
        error: "Lỗi khi lấy danh sách modes",
      });
    }
  }

  async getAllConversations(req, res) {
    try {
      const userId = req.user?.userId; // Từ JWT middleware

      // Tìm tất cả conversations của user
      const conversations = await database.conversation
        .find(userId ? { userId } : {})
        .sort({ updatedAt: -1 })
        .select("sessionId messages createdAt updatedAt")
        .lean();

      // Format response
      const formattedConversations = conversations.map((conv) => ({
        sessionId: conv.sessionId,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages?.length || 0,
        lastMessage:
          conv.messages?.length > 0
            ? conv.messages[conv.messages.length - 1].content?.substring(0, 100)
            : null,
      }));

      res.json({
        success: true,
        conversations: formattedConversations,
        total: formattedConversations.length,
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách conversations:", error);
      res.status(500).json({ error: "Lỗi máy chủ nội bộ." });
    }
  }

  async webSearch(req, res) {
    try {
      const { message, sessionId } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      console.log(
        `🌐 Web Search - Nhận tin nhắn: "${message}" từ session: ${sessionId}`
      );

      const result = await chatService.webSearch(message, sessionId);
      const stream = result.stream;
      const saveHistoryCallback = result.saveHistoryCallback;

      let fullResponse = "";
      let chunkCount = 0;

      // Stream từng chunk
      for await (const chunk of stream) {
        chunkCount++;
        fullResponse += chunk;

        console.log(`📤 Web Search Chunk ${chunkCount}:`, chunk);

        res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);

        if (res.flush) res.flush();
      }

      console.log(`✅ Web Search hoàn tất`);

      await saveHistoryCallback(fullResponse);

      res.write("data:\n\n");
      res.end();
    } catch (error) {
      console.error("❌ Error in web search:", error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
}

const chatController = new ChatController();
export default chatController;
