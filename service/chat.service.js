"use strict";
import { ollama } from "../config/connectModel.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
class ChatService {
  async chat(message) {
    const systemInstruction = new SystemMessage(
      "Bạn là một trợ lý AI chuyên về tư vấn tuyển sinh đại học tại Việt Nam. " +
        "Hãy luôn luôn trả lời bằng tiếng Việt một cách lịch sự, rõ ràng và dễ hiểu. " +
        "Tuyệt đối không sử dụng tiếng Anh trừ khi đó là tên riêng hoặc thuật ngữ không thể dịch."
    );
    const userQuestion = new HumanMessage(message);

    try {
      // Sử dụng invoke thay vì stream để đơn giản hóa
      const response = await ollama.invoke([systemInstruction, userQuestion]);
      console.log(`AI Response:`, response);

      // Trích xuất nội dung text từ response
      const responseText =
        response.content || response.text || response.toString();
      return responseText;
    } catch (error) {
      console.error("Lỗi khi gọi Ollama:", error);
      return "Xin lỗi, tôi không thể trả lời câu hỏi này lúc này.";
    }
  }
}
const chatService = new ChatService();
export default chatService;
