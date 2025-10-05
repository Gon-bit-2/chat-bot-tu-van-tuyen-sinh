import React, { useState } from "react";
import { api } from "../config/axios";
import { authService } from "../services/authService";

const AxiosExample = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Ví dụ sử dụng trực tiếp api helper
  const handleDirectApiCall = async () => {
    setLoading(true);
    setError(null);

    try {
      // Ví dụ gọi API đăng nhập
      const response = await api.post("/auth/login", {
        email: "test@example.com",
        password: "password123",
      });

      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  // Ví dụ sử dụng service
  const handleServiceCall = async () => {
    setLoading(true);
    setError(null);

    try {
      // Sử dụng authService
      const response = await authService.login({
        email: "test@example.com",
        password: "password123",
      });

      setResult(response);
    } catch (err) {
      setError(err.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  // Ví dụ upload file
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.upload("/upload", formData, (progress) => {
        console.log(`Upload progress: ${progress}%`);
      });

      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Upload thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Ví dụ sử dụng Axios</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">1. Gọi API trực tiếp</h2>
          <button
            onClick={handleDirectApiCall}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? "Đang gọi..." : "Gọi API đăng nhập"}
          </button>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">2. Sử dụng Service</h2>
          <button
            onClick={handleServiceCall}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? "Đang gọi..." : "Gọi Service đăng nhập"}
          </button>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">3. Upload file</h2>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={loading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Lỗi:</strong> {error}
          </div>
        )}

        {result && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <strong>Kết quả:</strong>
            <pre className="mt-2 text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Cách sử dụng:</h3>
        <div className="text-sm space-y-2">
          <p>
            <strong>1. Import:</strong>{" "}
            <code>import {`{ api }`} from '../config/axios'</code>
          </p>
          <p>
            <strong>2. Gọi API:</strong>{" "}
            <code>const response = await api.post('/auth/login', data)</code>
          </p>
          <p>
            <strong>3. Xử lý response:</strong>{" "}
            <code>const data = response.data</code>
          </p>
          <p>
            <strong>4. Xử lý lỗi:</strong> Sử dụng try-catch hoặc .catch()
          </p>
        </div>
      </div>
    </div>
  );
};

export default AxiosExample;
