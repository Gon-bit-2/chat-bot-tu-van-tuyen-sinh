import api from "@helper/api";

export const chatService = {
  // Gửi tin nhắn với streaming response
  sendMessageStream: async (message, sessionId) => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        sessionId: sessionId || "default",
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Phản hồi từ mạng không hợp lệ.");
    }

    return response;
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

  // Xóa lịch sử chat
  clearHistory: async (sessionId) => {
    const response = await api.post("/chat/clear", { sessionId });
    return response.data;
  },

  // Lấy độ dài lịch sử chat
  getHistoryLength: async (sessionId) => {
    const response = await api.get(`/chat/history-length/${sessionId}`);
    return response.data;
  },
};
