/**
 * ⚡ Optimized Chat Service với request cancellation và caching
 */

import api from "@helper/api";

class OptimizedChatService {
  constructor() {
    // In-memory cache cho conversations
    this.conversationsCache = null;
    this.conversationsCacheTime = 0;
    this.CACHE_TTL = 30000; // 30 seconds

    // Active requests tracking
    this.activeRequests = new Map();
  }

  /**
   * Cancel một request đang chạy
   */
  cancelRequest(key) {
    const controller = this.activeRequests.get(key);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(key);
    }
  }

  /**
   * Cancel tất cả requests
   */
  cancelAllRequests() {
    this.activeRequests.forEach((controller) => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Tạo AbortController cho request
   */
  getAbortController(key) {
    // Cancel request cũ nếu có
    this.cancelRequest(key);

    const controller = new AbortController();
    this.activeRequests.set(key, controller);

    return controller;
  }

  /**
   * Lấy danh sách modes với caching
   */
  async getChatModes() {
    const response = await api.get("/chat/modes");
    return response.data;
  }

  /**
   * Gửi message với streaming và cancellation support
   */
  async sendMessageStream(message, sessionId, mode = null, onCancel = null) {
    const token = localStorage.getItem("token");
    const requestBody = {
      message,
      sessionId: sessionId || "default",
    };

    if (mode) {
      requestBody.mode = mode;
    }

    // Create abort controller
    const controller = this.getAbortController(`stream-${sessionId}`);

    // Register cancel callback
    if (onCancel) {
      controller.signal.addEventListener("abort", onCancel);
    }

    const apiUrl = import.meta.env.VITE_API_URL || "";
    let endpoint;

    if (apiUrl) {
      if (apiUrl.endsWith("/v1/api") || apiUrl.endsWith("/v1/api/")) {
        endpoint = `${apiUrl.replace(/\/v1\/api\/?$/, "")}/v1/api/chat`;
      } else if (apiUrl.includes("/v1/api/")) {
        endpoint = `${apiUrl}/chat`;
      } else {
        endpoint = `${apiUrl}/v1/api/chat`;
      }
    } else {
      endpoint = "/v1/api/chat";
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal, // Add abort signal
      });

      if (!response.ok || !response.body) {
        throw new Error("Phản hồi từ mạng không hợp lệ.");
      }

      return response;
    } finally {
      // Cleanup
      this.activeRequests.delete(`stream-${sessionId}`);
    }
  }

  /**
   * Get chat history
   */
  async getChatHistory(conversationId) {
    const controller = this.getAbortController(`history-${conversationId}`);

    try {
      const response = await api.get(`/chat/history/${conversationId}`, {
        signal: controller.signal,
      });
      return response.data;
    } finally {
      this.activeRequests.delete(`history-${conversationId}`);
    }
  }

  /**
   * Get all conversations với caching
   */
  async getAllConversations(forceRefresh = false) {
    // Check cache
    const now = Date.now();
    if (
      !forceRefresh &&
      this.conversationsCache &&
      now - this.conversationsCacheTime < this.CACHE_TTL
    ) {
      console.log("📦 Using cached conversations");
      return this.conversationsCache;
    }

    const controller = this.getAbortController("conversations");

    try {
      const response = await api.get("/chat/conversations", {
        signal: controller.signal,
      });

      // Update cache
      this.conversationsCache = response.data;
      this.conversationsCacheTime = now;

      return response.data;
    } finally {
      this.activeRequests.delete("conversations");
    }
  }

  /**
   * Clear conversations cache
   */
  clearConversationsCache() {
    this.conversationsCache = null;
    this.conversationsCacheTime = 0;
  }

  /**
   * Create conversation
   */
  async createConversation(previousSessionId = null) {
    const response = await api.post("/chat/conversation", {
      previousSessionId,
    });

    // Invalidate cache
    this.clearConversationsCache();

    return response.data;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(sessionId) {
    const response = await api.delete(`/chat/conversations/${sessionId}`);

    // Invalidate cache
    this.clearConversationsCache();

    return response.data;
  }

  /**
   * Clear all history
   */
  async clearHistory() {
    const response = await api.post("/chat/clear");

    // Invalidate cache
    this.clearConversationsCache();

    return response.data;
  }

  /**
   * Web search with cancellation
   */
  async webSearch(message, sessionId) {
    const token = localStorage.getItem("token");
    const controller = this.getAbortController(`web-search-${sessionId}`);

    const apiUrl = import.meta.env.VITE_API_URL || "";
    let endpoint;

    if (apiUrl) {
      endpoint = apiUrl.includes("/v1/api/")
        ? `${apiUrl}/chat/web-search`
        : `${apiUrl}/v1/api/chat/web-search`;
    } else {
      endpoint = "/v1/api/chat/web-search";
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, sessionId }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Phản hồi từ mạng không hợp lệ.");
      }

      return response;
    } finally {
      this.activeRequests.delete(`web-search-${sessionId}`);
    }
  }

  /**
   * Get cache stats (new endpoint)
   */
  async getCacheStats() {
    const response = await api.get("/chat/cache-stats");
    return response.data;
  }

  /**
   * Clear server cache (new endpoint)
   */
  async clearServerCache(mode = null) {
    const response = await api.post("/chat/cache/clear", { mode });
    return response.data;
  }
}

// Export singleton instance
export const optimizedChatService = new OptimizedChatService();

// Keep original service for backward compatibility
export const chatService = {
  getChatModes: () => optimizedChatService.getChatModes(),
  sendMessageStream: (message, sessionId, mode) =>
    optimizedChatService.sendMessageStream(message, sessionId, mode),
  getChatHistory: (conversationId) =>
    optimizedChatService.getChatHistory(conversationId),
  getAllConversations: () => optimizedChatService.getAllConversations(),
  createConversation: (previousSessionId) =>
    optimizedChatService.createConversation(previousSessionId),
  deleteConversation: (sessionId) =>
    optimizedChatService.deleteConversation(sessionId),
  clearHistory: () => optimizedChatService.clearHistory(),
  webSearch: (message, sessionId) =>
    optimizedChatService.webSearch(message, sessionId),
  getCacheStats: () => optimizedChatService.getCacheStats(),
  clearServerCache: (mode) => optimizedChatService.clearServerCache(mode),

  // New methods
  cancelAllRequests: () => optimizedChatService.cancelAllRequests(),
  clearConversationsCache: () => optimizedChatService.clearConversationsCache(),
};

export default chatService;
