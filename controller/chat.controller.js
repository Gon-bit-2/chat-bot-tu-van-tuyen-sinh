"use strict";
import chatService from "../service/chat.service.js";
class ChatController {
  async chat(req, res) {
    const { message, sessionId } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ error: "Không tìm thấy message trong request" });
    }
    const metadata = {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
      userId: req.user?._id,
    };
    const response = await chatService.chat(message, sessionId || "default");
    const historyLength = await chatService.getHistoryLength(
      sessionId || "default"
    );
    res.json({
      reply: response,
      sessionId: sessionId || "default",
      historyLength,
    });
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
