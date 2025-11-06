import api from "@helper/api";

export const chatService = {
  // Lấy danh sách các mode khả dụng
  getChatModes: async () => {
    const response = await api.get("/chat/modes");
    return response.data;
  },

  // Gửi tin nhắn với streaming response
  sendMessageStream: async (message, sessionId, mode = null) => {
    const token = localStorage.getItem("token");
    const requestBody = {
      message,
      sessionId: sessionId || "default",
    };

    // Thêm mode vào request body nếu có
    if (mode) {
      requestBody.mode = mode;
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
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

  // Lấy tất cả cuộc trò chuyện
  getAllConversations: async () => {
    const response = await api.get("/chat/conversations");
    return response.data;
  },

  // Tạo cuộc trò chuyện mới
  createConversation: async () => {
    const response = await api.post("/chat/conversation");
    return response.data;
  },

  // Xóa lịch sử chat
  clearHistory: async () => {
    const response = await api.post("/chat/clear");
    return response.data;
  },

  // Xóa một cuộc trò chuyện cụ thể
  deleteConversation: async (sessionId) => {
    // Thử /chat/conversations/:id trước (khớp với GET /chat/conversations)
    const response = await api.delete(`/chat/conversations/${sessionId}`);
    return response.data;
  },

  // Lấy độ dài lịch sử chat
  getHistoryLength: async (sessionId) => {
    const response = await api.get(`/chat/history-length/${sessionId}`);
    return response.data;
  },

  // Web search API
  webSearch: async (message, sessionId) => {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/chat/web-search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          sessionId: sessionId || "default",
        }),
      }
    );

    if (!response.ok || !response.body) {
      throw new Error("Phản hồi từ mạng không hợp lệ.");
    }

    return response;
  },
};
