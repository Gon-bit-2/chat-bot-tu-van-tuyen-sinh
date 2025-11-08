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

    // Sử dụng proxy hoặc VITE_API_URL
    const apiUrl = import.meta.env.VITE_API_URL || "";
    let endpoint;
    if (apiUrl) {
      // Nếu VITE_API_URL đã chứa /v1/api, chỉ cần thêm /chat
      if (apiUrl.endsWith("/v1/api") || apiUrl.endsWith("/v1/api/")) {
        endpoint = `${apiUrl.replace(/\/v1\/api\/?$/, "")}/v1/api/chat`;
      } else if (apiUrl.includes("/v1/api/")) {
        // Nếu đã có /v1/api/ trong URL, chỉ thêm /chat
        endpoint = `${apiUrl}/chat`;
      } else {
        // Nếu chưa có /v1/api, thêm đầy đủ
        endpoint = `${apiUrl}/v1/api/chat`;
      }
    } else {
      // Dùng relative path để Vite proxy xử lý
      endpoint = "/v1/api/chat";
    }

    const response = await fetch(endpoint, {
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
  createConversation: async (previousSessionId = null) => {
    const response = await api.post("/chat/conversation", {
      previousSessionId,
    });
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
    // Sử dụng proxy hoặc VITE_API_URL
    const apiUrl = import.meta.env.VITE_API_URL || "";
    let endpoint;
    if (apiUrl) {
      // Nếu VITE_API_URL đã chứa /v1/api, chỉ cần thêm /chat/web-search
      if (apiUrl.endsWith("/v1/api") || apiUrl.endsWith("/v1/api/")) {
        endpoint = `${apiUrl.replace(/\/v1\/api\/?$/, "")}/v1/api/chat/web-search`;
      } else if (apiUrl.includes("/v1/api/")) {
        // Nếu đã có /v1/api/ trong URL, chỉ thêm /chat/web-search
        endpoint = `${apiUrl}/chat/web-search`;
      } else {
        // Nếu chưa có /v1/api, thêm đầy đủ
        endpoint = `${apiUrl}/v1/api/chat/web-search`;
      }
    } else {
      // Dùng relative path để Vite proxy xử lý
      endpoint = "/v1/api/chat/web-search";
    }

    const response = await fetch(endpoint, {
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
};
