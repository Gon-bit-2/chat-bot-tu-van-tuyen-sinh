import mongoose from "mongoose";
import "dotenv/config";
import Conversation from "../router/model/conversation.model.js";
import KeyToken from "../router/model/keytoken.model.js";
import User from "../router/model/user.model.js";

class Database {
  async connectDB() {
    try {
      // ⚡ OPTIMIZATION: Thêm connection pool và timeout options
      const conn = await mongoose.connect(
        process.env.MONGODB_URI ||
          "mongodb://localhost:27017/chatbot-tuyensinh",
        {
          maxPoolSize: 10, // Tăng pool size từ default 5 lên 10
          minPoolSize: 2, // Duy trì ít nhất 2 connections
          serverSelectionTimeoutMS: 5000, // Timeout sau 5s
          socketTimeoutMS: 45000, // Socket timeout 45s
          family: 4, // Use IPv4, skip trying IPv6
        }
      );

      console.log(`MongoDB Connected: ${conn.connection.host}`);

      // Xử lý các event
      mongoose.connection.on("error", (err) => {
        console.error("MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.log("MongoDB disconnected");
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await mongoose.connection.close();
        console.log("MongoDB connection closed through app termination");
        process.exit(0);
      });
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      process.exit(1);
    }
  }
  get conversation() {
    return Conversation;
  }
  get user() {
    return User;
  }
  get token() {
    return KeyToken;
  }
}
const database = new Database();
export default database;
