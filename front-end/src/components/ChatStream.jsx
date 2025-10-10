import { useState, useEffect, useRef } from "react";

function ChatStreamComponent() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingResponse]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const newUserMessage = { role: "user", content: message };
    setChatHistory((prev) => [...prev, newUserMessage]);
    setMessage("");
    setStreamingResponse("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:4321/v1/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGUxMzZkNjk5MDQwMzcxYjg3NzFkYzciLCJlbWFpbCI6InZuYXRoaWVuNzAyN0BnbWFpbC5jb20iLCJpYXQiOjE3NTk1OTQyODcsImV4cCI6MTc2MDE5OTA4N30.khUV5XVM3MltE3J3_HmWf_KgLw72SLzhqoFquRCmvMw`,
        },
        body: JSON.stringify({
          message: message,
          sessionId: "test04",
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Network response was not ok.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const dataStr = line.substring(5);
            try {
              const data = JSON.parse(dataStr);

              if (data.event === "end") {
                setChatHistory((prev) => [
                  ...prev,
                  { role: "ai", content: accumulatedResponse },
                ]);
                setStreamingResponse("");
                setIsLoading(false);
                return;
              }
              if (data.chunk) {
                accumulatedResponse += data.chunk;
                setStreamingResponse(accumulatedResponse);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching stream:", error);
      setStreamingResponse("Xin lỗi, đã có lỗi xảy ra.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            🎓 Chatbot Tuyển Sinh
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Hỏi đáp thông tin tuyển sinh - Hỗ trợ 24/7
          </p>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {chatHistory.length === 0 && !streamingResponse && (
            <div className="text-center py-12">
              <div className="inline-block p-4 bg-white rounded-full shadow-lg mb-4">
                <svg
                  className="w-12 h-12 text-blue-500"
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
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Xin chào! 👋
              </h2>
              <p className="text-gray-500">
                Tôi có thể giúp gì cho bạn về tuyển sinh hôm nay?
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
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600"
                      : "bg-gradient-to-br from-purple-500 to-indigo-600"
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
                    <svg
                      className="w-6 h-6 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                      <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                    </svg>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl shadow-md ${
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
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-purple-500 to-indigo-600">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                  </svg>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm shadow-md bg-white text-gray-800 border border-gray-200">
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập câu hỏi của bạn..."
                disabled={isLoading}
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
              disabled={!message.trim() || isLoading}
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
  );
}

export default ChatStreamComponent;
