import { api } from "../config/axios";

// Service cho các API liên quan đến authentication
export const authService = {
  // Đăng ký tài khoản mới
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  // Đăng nhập
  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    return response.data;
  },

  // Đăng xuất
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },

  // Refresh token
  refreshToken: async (refreshToken) => {
    const response = await api.post("/auth/refresh-token", {
      refreshToken,
    });
    return response.data;
  },

  // Lấy thông tin user hiện tại
  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
};

export default authService;
