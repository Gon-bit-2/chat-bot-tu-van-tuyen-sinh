import axiosConfig from "@config/axios";

/**
 * API helper để sử dụng dễ dàng hơn
 * @typedef {Object} ApiHelper
 * @property {Function} get - GET request
 * @property {Function} post - POST request
 * @property {Function} put - PUT request
 * @property {Function} patch - PATCH request
 * @property {Function} delete - DELETE request
 * @property {Function} upload - Upload file
 */
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
export default api;
