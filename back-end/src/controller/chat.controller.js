"use strict";
import chatService from "../service/chat.service.js";
import database from "../config/database.js";
class ChatController {
  async chat(req, res) {
    const { message, sessionId = "default" } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ error: "Không tìm thấy message trong request" });
    }

    try {
      // Thiết lập headers cho Server-Sent Events (SSE)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const { stream, saveHistoryCallback } = await chatService.chat(
        message,
        sessionId
      );

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.content?.toString() || "";
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ reply: content })}\n\n`);
      }

      // Sau khi stream kết thúc, gọi callback để lưu lịch sử
      await saveHistoryCallback(fullResponse);

      res.end();
    } catch (error) {
      console.error("Lỗi khi xử lý chat stream:", error);
      res.status(500).json({ error: "Lỗi máy chủ nội bộ." });
    }
  }
  async createConversation(req, res) {
    try {
      // Tạo session ID unique
      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Tạo conversation mới trong database
      const conversation = new database.conversation({
        sessionId,
        messages: [],
        userId: req.user?.userId, // Nếu có user authentication
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip,
      });

      await conversation.save();

      res.json({
        success: true,
        sessionId,
        message: "Cuộc trò chuyện mới đã được tạo",
      });
    } catch (error) {
      console.error("Lỗi khi tạo cuộc trò chuyện:", error);
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
}
const chatController = new ChatController();
export default chatController;
