"use strict";
import chatService from "../service/chat.service.js";
class ChatController {
  async chat(req, res) {
    const { message } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ error: "Không tìm thấy message trong request" });
    }
    const response = await chatService.chat(message);
    res.json({
      reply: response,
    });
  }
}
const chatController = new ChatController();
export default chatController;
