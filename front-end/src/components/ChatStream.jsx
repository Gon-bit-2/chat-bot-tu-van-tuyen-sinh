import { useState, useEffect, useRef, useCallback } from "react";
import { chatService } from "@services/chat.service";
import { useAuth } from "@hook/useAuth";

function ChatStreamComponent() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [modes, setModes] = useState([]);
  const [selectedMode, setSelectedMode] = useState(null);
  const [isLoadingModes, setIsLoadingModes] = useState(true);
  const chatEndRef = useRef(null);
  const { user, logout } = useAuth();

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingResponse]);

  // Load chat modes
  const loadChatModes = useCallback(async () => {
    setIsLoadingModes(true);
    try {
      const data = await chatService.getChatModes();
      if (data.success && data.modes) {
        // Chỉ lấy các mode khả dụng
        let availableModes = data.modes.filter((mode) => mode.isAvailable);

        // Đảm bảo có tuỳ chọn Web Search nếu backend chưa trả về
        const hasWebSearch = availableModes.some((m) => m.id === "web-search");
        if (!hasWebSearch) {
          availableModes = [
            ...availableModes,
            {
              id: "web-search",
              name: "Trò chuyện",
              icon: "💬",
              isAvailable: true,
            },
          ];
        }
        setModes(availableModes);

        // Set mode mặc định là mode đầu tiên khả dụng
        setSelectedMode((prevMode) => {
          if (!prevMode && availableModes.length > 0) {
            return availableModes[0].id;
          }
          return prevMode;
        });
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách modes:", error);
      // Fallback mode nếu không load được - sử dụng admission làm mặc định
      setModes([
        {
          id: "admission",
          name: "Tư vấn tuyển sinh",
          icon: "🎓",
          isAvailable: true,
        },
      ]);
      setSelectedMode("admission");
    } finally {
      setIsLoadingModes(false);
    }
  }, []);

  // Load all conversations
  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const data = await chatService.getAllConversations();
      if (data.success) {
        // Chuẩn hoá dữ liệu để luôn có field id cho UI
        const normalized = (data.conversations || []).map((c) => ({
          // ưu tiên id; fallback sessionId hoặc _id
          id: c.id || c.sessionId || c._id,
          title: c.title || c.name || "Cuộc trò chuyện mới",
          createdAt:
            c.createdAt ||
            c.created_at ||
            c.timestamp ||
            new Date().toISOString(),
          // giữ lại các field khác (để không mất thông tin cần thiết)
          ...c,
        }));
        setConversations(normalized);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách cuộc trò chuyện:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Load conversation history
  const loadConversationHistory = useCallback(async (conversationId) => {
    try {
      const data = await chatService.getChatHistory(conversationId);
      if (data.success && data.messages) {
        setChatHistory(data.messages);
      }
    } catch (error) {
      console.error("Lỗi khi tải lịch sử:", error);
    }
  }, []);

  // Load conversations and modes on mount
  useEffect(() => {
    loadConversations();
    loadChatModes();
    const savedSessionId = localStorage.getItem("chatSessionId");
    if (savedSessionId) {
      setSessionId(savedSessionId);
      loadConversationHistory(savedSessionId);
    }
  }, [loadConversations, loadChatModes, loadConversationHistory]);

  // Create new conversation
  const createNewSession = async () => {
    try {
      // Lưu sessionId hiện tại để gửi lên server
      const currentSessionId = sessionId;

      // If current session has messages but is not in conversations yet, add optimistically
      if (currentSessionId && chatHistory.length > 0) {
        const exists = conversations.some((c) => c.id === currentSessionId);
        if (!exists) {
          const firstUserMsg = chatHistory.find((m) => m.role === "user");
          const preview =
            firstUserMsg?.content?.slice(0, 40) || "Cuộc trò chuyện mới";
          setConversations((prev) => [
            {
              id: currentSessionId,
              title: preview,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }

      // Gửi previousSessionId để server đặt tên cho cuộc trò chuyện cũ
      const data = await chatService.createConversation(currentSessionId);
      if (data.success) {
        setSessionId(data.sessionId);
        localStorage.setItem("chatSessionId", data.sessionId);
        setChatHistory([]);
        await loadConversations();
      }
    } catch (error) {
      console.error("Lỗi khi tạo session mới:", error);
    }
  };

  // Switch to a conversation
  const switchConversation = async (conversation) => {
    setSessionId(conversation.id);
    localStorage.setItem("chatSessionId", conversation.id);
    await loadConversationHistory(conversation.id);
  };

  // Delete a conversation
  const deleteConversation = async (conversationIdOrObj, event) => {
    event.stopPropagation();

    // Hỗ trợ cả khi truyền object conversation hoặc chuỗi id
    const id =
      typeof conversationIdOrObj === "string"
        ? conversationIdOrObj
        : conversationIdOrObj?.id ||
          conversationIdOrObj?.sessionId ||
          conversationIdOrObj?._id;

    if (!id) {
      console.error("Không có conversationId để xóa");
      return;
    }

    if (window.confirm("Bạn có chắc muốn xóa cuộc trò chuyện này?")) {
      try {
        console.log("Đang xóa conversation:", id);
        const data = await chatService.deleteConversation(id);

        if (data && data.success) {
          // Xóa khỏi local state ngay lập tức để UI update
          setConversations((prev) =>
            prev.filter(
              (conv) => (conv.id || conv.sessionId || conv._id) !== id
            )
          );

          if (id === sessionId) {
            setChatHistory([]);
            setSessionId(null);
            localStorage.removeItem("chatSessionId");
          }

          // Reload để đồng bộ với backend
          await loadConversations();
        } else {
          console.error("Không thể xóa conversation:", data);
          alert("Không thể xóa cuộc trò chuyện này");
        }
      } catch (error) {
        console.error("Lỗi khi xóa cuộc trò chuyện:", error);
        // Xóa khỏi UI ngay cả khi API fail (optimistic update)
        setConversations((prev) =>
          prev.filter((conv) => (conv.id || conv.sessionId || conv._id) !== id)
        );

        if (id === sessionId) {
          setChatHistory([]);
          setSessionId(null);
          localStorage.removeItem("chatSessionId");
        }
      }
    }
  };

  // Clear all history
  const handleClearAll = async () => {
    if (window.confirm("Bạn có chắc muốn xóa tất cả lịch sử trò chuyện?")) {
      try {
        const data = await chatService.clearHistory();
        if (data.success) {
          await loadConversations();
          setChatHistory([]);
          setSessionId(null);
          localStorage.removeItem("chatSessionId");
        }
      } catch (error) {
        console.error("Lỗi khi xóa lịch sử:", error);
      }
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Hôm nay";
    if (diffInDays === 1) return "Hôm qua";
    if (diffInDays < 7) return `${diffInDays} ngày trước`;

    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    
    // Đảm bảo có sessionId trước khi gửi message
    let currentSessionId = sessionId || localStorage.getItem("chatSessionId");
    if (!currentSessionId) {
      await createNewSession();
      // Lấy sessionId mới sau khi tạo
      currentSessionId = sessionId || localStorage.getItem("chatSessionId");
    }
    
    // Detect slash commands for mode overrides (e.g., /web-search or /web)
    let outgoingText = message.trim();
    let effectiveMode = selectedMode;

    if (outgoingText.toLowerCase().startsWith("/web-search")) {
      outgoingText = outgoingText.replace(/^\/web-search\s*/i, "");
      effectiveMode = "web-search";
    } else if (outgoingText.toLowerCase().startsWith("/web")) {
      outgoingText = outgoingText.replace(/^\/web\s*/i, "");
      effectiveMode = "web-search";
    }

    const newUserMessage = { role: "user", content: outgoingText };
    setChatHistory((prev) => [...prev, newUserMessage]);
    setMessage("");
    setStreamingResponse("");
    setIsLoading(true);

    let accumulatedResponse = "";

    try {
      // Đặt tiêu đề cuộc trò chuyện dựa trên tin nhắn đầu tiên nếu chưa có
      if (currentSessionId) {
        const existing = conversations.find((c) => c.id === currentSessionId);
        if (
          !existing ||
          !existing.title ||
          existing.title === "Cuộc trò chuyện mới"
        ) {
          const modeMeta = modes.find(
            (m) => m.id === (effectiveMode || selectedMode)
          );
          const modePrefix = modeMeta?.icon ? `${modeMeta.icon} ` : "";
          const baseTitle = outgoingText.replace(/^\s+|\s+$/g, "").slice(0, 50);
          const computedTitle = `${modePrefix}${
            baseTitle || "Cuộc trò chuyện mới"
          }`;

          setConversations((prev) => {
            const found = prev.some((c) => c.id === currentSessionId);
            if (!found) {
              // Nếu chưa có trong danh sách, thêm mới với title
              return [
                {
                  id: currentSessionId,
                  title: computedTitle,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ];
            }
            return prev.map((c) =>
              c.id === currentSessionId ? { ...c, title: computedTitle } : c
            );
          });
        }
      }

      // Gửi message: nếu là web-search, dùng endpoint chuyên biệt
      // currentSessionId đã được đảm bảo có giá trị ở trên
      const response =
        effectiveMode === "web-search"
          ? await chatService.webSearch(outgoingText, currentSessionId)
          : await chatService.sendMessageStream(
              outgoingText,
              currentSessionId,
              effectiveMode
            );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setChatHistory((prev) => [
            ...prev,
            { role: "ai", content: accumulatedResponse },
          ]);
          setStreamingResponse("");
          await loadConversations(); // Reload conversations after message
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const dataStr = line.substring(5).trim();

            // Bỏ qua nếu dataStr rỗng
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.message) {
                accumulatedResponse += data.message;
                setStreamingResponse(accumulatedResponse);
              } else if (data.reply) {
                accumulatedResponse += data.reply;
                setStreamingResponse(accumulatedResponse);
              } else if (data.chunk) {
                accumulatedResponse += data.chunk;
                setStreamingResponse(accumulatedResponse);
              } else if (data.content) {
                // Handle content field
                accumulatedResponse += data.content;
                setStreamingResponse(accumulatedResponse);
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch (error) {
              // Chỉ log lỗi nếu không phải là lỗi JSON parse thông thường
              if (
                error instanceof SyntaxError &&
                error.message.includes("JSON")
              ) {
                // Có thể là text thuần, append vào response
                accumulatedResponse += dataStr;
                setStreamingResponse(accumulatedResponse);
              } else {
                console.error("Error parsing stream data:", error);
                // Fallback: append raw text
                if (dataStr) {
                  accumulatedResponse += dataStr;
                  setStreamingResponse(accumulatedResponse);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Lỗi khi fetch stream:", error);

      // Kiểm tra xem đã có response nào chưa
      if (accumulatedResponse) {
        // Nếu đã có response, lưu nó vào history
        setChatHistory((prev) => [
          ...prev,
          { role: "ai", content: accumulatedResponse },
        ]);
      } else {
        // Nếu chưa có response, hiển thị lỗi
        const errorMessage =
          "Xin lỗi, đã có lỗi xảy ra khi kết nối. Vui lòng thử lại sau.";

        setStreamingResponse("");
        setChatHistory((prev) => [
          ...prev,
          { role: "ai", content: errorMessage },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Lịch sử trò chuyện
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={createNewSession}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Tạo mới"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
                <button
                  onClick={handleClearAll}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Xóa tất cả"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <button
              onClick={createNewSession}
              className="w-full py-2 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium text-sm"
            >
              + Cuộc trò chuyện mới
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Chưa có cuộc trò chuyện nào
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {conversations.map((conversation, index) => (
                  <div
                    key={conversation.id || `conv-${index}`}
                    onClick={() => switchConversation(conversation)}
                    className={`group p-3 rounded-lg cursor-pointer transition-all ${
                      sessionId === conversation.id
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-gray-800 truncate flex-1">
                        {conversation.title || "Cuộc trò chuyện mới"}
                      </p>
                      <button
                        onClick={(e) =>
                          deleteConversation(
                            conversation.id ||
                              conversation.sessionId ||
                              conversation._id,
                            e
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                      >
                        <svg
                          className="w-4 h-4 text-red-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(conversation.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Footer - User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.name?.charAt(0).toUpperCase() ||
                  user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-medium text-sm"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title={sidebarOpen ? "Ẩn lịch sử" : "Hiện lịch sử"}
              >
                {sidebarOpen ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  💬 Chatbot Hỗ Trợ
                </h1>
                <p className="text-sm text-gray-600">
                  Tư vấn tuyển sinh & Hỗ trợ sinh viên - Hỗ trợ 24/7
                </p>
              </div>
            </div>
            {selectedMode && modes.length > 0 && (
              <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-2">
                <span>
                  {modes.find((m) => m.id === selectedMode)?.icon || "🎓"}
                </span>
                <span>
                  {modes.find((m) => m.id === selectedMode)?.name || "Chat"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
          <div className="max-w-4xl mx-auto space-y-4">
            {chatHistory.length === 0 && !streamingResponse && (
              <div className="text-center py-16">
                <div className="inline-block p-6 bg-white rounded-full shadow-lg mb-6">
                  <svg
                    className="w-16 h-16 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                  Xin chào! 👋
                </h2>
                <p className="text-gray-500 text-lg">
                  Chọn chế độ phù hợp và bắt đầu trò chuyện với tôi!
                </p>
              </div>
            )}

            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                } animate-fade-in`}
              >
                <div
                  className={`flex max-w-[75%] ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  } gap-3`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md overflow-hidden ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-blue-600"
                        : "bg-white"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <img
                        src="/logo.png"
                        alt="Chatbot Logo"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm"
                        : "bg-white text-gray-800 rounded-tl-sm border border-gray-200"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming Response */}
            {streamingResponse && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex max-w-[75%] gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-white overflow-hidden">
                    <img
                      src="/logo.png"
                      alt="Chatbot Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm bg-white text-gray-800 border border-gray-200">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {streamingResponse}
                    </p>
                    <span className="inline-block w-1 h-4 ml-1 bg-gray-600 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Form */}
        <div className="bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-4xl mx-auto px-6 py-4">
            {/* Mode Selector */}
            {!isLoadingModes && modes.length > 0 && (
              <div className="mb-3">
                <select
                  value={selectedMode || ""}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-sm font-medium"
                  disabled={isLoading}
                >
                  {modes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.icon} {mode.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Nhập câu hỏi của bạn..."
                  disabled={isLoading || isLoadingModes}
                  className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {isLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!message.trim() || isLoading || isLoadingModes}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
              >
                <span>Gửi</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Nhấn Enter để gửi tin nhắn
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatStreamComponent;
