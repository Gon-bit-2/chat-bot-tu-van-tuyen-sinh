import { createContext, useState, useEffect } from "react";
import { authService } from "@services/auth.service";
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kiểm tra token khi component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (savedToken && savedUser && savedUser !== "undefined") {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));

          // Kiểm tra token có còn hợp lệ không
          try {
            const response = await authService.getCurrentUser();
            setUser(response.metadata);
          } catch (error) {
            // Token không hợp lệ, xóa khỏi localStorage
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("refreshToken");
            setToken(null);
            setUser(null);
            console.error("Lỗi khi lấy thông tin user:", error);
          }
        }
      } catch (error) {
        console.error("Lỗi khi khởi tạo auth:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("refreshToken");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);

      // Truy cập đúng cấu trúc response từ backend
      const { user: userData, tokens } = response.metadata;
      const { accessToken, refreshToken } = tokens;

      // Lưu vào localStorage
      localStorage.setItem("token", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(userData));

      // Cập nhật state
      setToken(accessToken);
      setUser(userData);

      return { success: true, user: userData };
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      return { success: true, data: response };
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    } finally {
      // Xóa khỏi localStorage và state
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      setToken(null);
      setUser(null);
      window.location.href = "/login";
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
