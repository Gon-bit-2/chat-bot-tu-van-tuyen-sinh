import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["system", "human", "ai"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const conversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messages: [messageSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    // Metadata tùy chọn
    userId: String,
    userAgent: String,
    ipAddress: String,
    // Tên cuộc trò chuyện (tự động tạo từ tin nhắn đầu tiên)
    title: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // Tự động cập nhật createdAt và updatedAt
  }
);

// Index để tối ưu query
conversationSchema.index({ sessionId: 1, updatedAt: -1 });

// Middleware để giới hạn số lượng messages
conversationSchema.pre("save", function (next) {
  // Giới hạn tối đa 50 messages per conversation
  if (this.messages.length > 50) {
    // Giữ system message đầu tiên và 48 messages gần nhất
    const systemMessage = this.messages.find((msg) => msg.type === "system");
    const recentMessages = this.messages.slice(-48);

    this.messages = systemMessage
      ? [
          systemMessage,
          ...recentMessages.filter((msg) => msg.type !== "system"),
        ]
      : recentMessages;
  }
  next();
});

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
