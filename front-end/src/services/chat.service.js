import { api } from "../config/axios";

export const chatService = {
  // Gửi tin nhắn
  sendMessage: async (messageData) => {
    const response = await api.post("/chat", messageData);
    return response.data;
  },

  // Lấy lịch sử chat
  getChatHistory: async (conversationId) => {
    const response = await api.get(`/chat/history/${conversationId}`);
    return response.data;
  },

  // Tạo cuộc trò chuyện mới
  createConversation: async () => {
    const response = await api.post("/chat/conversation");
    return response.data;
  },
};
