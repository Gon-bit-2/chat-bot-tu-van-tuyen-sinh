import axios from "axios";

// Tạo instance axios với config mặc định
const axiosConfig = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000, // 10 giây
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor - xử lý trước khi gửi request
axiosConfig.interceptors.request.use(
  (config) => {
    // Thêm token vào header nếu có
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request để debug (chỉ trong development)
    if (import.meta.env.NODE_ENV === "development") {
      console.log("🚀 Request:", {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error("❌ Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor - xử lý response trước khi trả về
axiosConfig.interceptors.response.use(
  (response) => {
    // Log response để debug (chỉ trong development)
    if (import.meta.env.NODE_ENV === "development") {
      console.log("✅ Response:", {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
    }

    return response;
  },
  (error) => {
    // Xử lý các lỗi phổ biến
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Token hết hạn hoặc không hợp lệ
          localStorage.removeItem("token");
          window.location.href = "/login";
          break;
        case 403:
          console.error("❌ Không có quyền truy cập");
          break;
        case 404:
          console.error("❌ Không tìm thấy resource");
          break;
        case 500:
          console.error("❌ Lỗi server");
          break;
        default:
          console.error(
            `❌ HTTP Error ${status}:`,
            data?.message || "Unknown error"
          );
      }
    } else if (error.request) {
      console.error("❌ Network Error:", error.message);
    } else {
      console.error("❌ Error:", error.message);
    }

    return Promise.reject(error);
  }
);

// Các helper functions để sử dụng dễ dàng hơn
export const api = {
  // GET request
  get: (url, config = {}) => axiosConfig.get(url, config),

  // POST request
  post: (url, data = {}, config = {}) => axiosConfig.post(url, data, config),

  // PUT request
  put: (url, data = {}, config = {}) => axiosConfig.put(url, data, config),

  // PATCH request
  patch: (url, data = {}, config = {}) => axiosConfig.patch(url, data, config),

  // DELETE request
  delete: (url, config = {}) => axiosConfig.delete(url, config),

  // Upload file
  upload: (url, formData, onUploadProgress = null) => {
    return axiosConfig.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: onUploadProgress
        ? (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onUploadProgress(percentCompleted);
          }
        : undefined,
    });
  },
};

// Export cả instance axios gốc để sử dụng trong trường hợp đặc biệt
export default axiosConfig;
