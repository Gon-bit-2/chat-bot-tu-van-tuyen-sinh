import NodeCache from "node-cache";

/**
 * Cache Service để lưu trữ câu trả lời phổ biến
 * Giảm thời gian phản hồi cho các câu hỏi lặp lại
 */
class CacheService {
  constructor() {
    // Cache với TTL 1 giờ (3600 giây)
    this.cache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 600, // Kiểm tra expired items mỗi 10 phút
      useClones: false, // Không clone objects để tăng performance
    });

    // Cache riêng cho từng mode với TTL khác nhau
    this.modeCache = {
      admission: new NodeCache({ stdTTL: 7200 }), // 2 giờ - dữ liệu tuyển sinh ít thay đổi
      "student-support": new NodeCache({ stdTTL: 3600 }), // 1 giờ
      "web-search": new NodeCache({ stdTTL: 1800 }), // 30 phút - dữ liệu web thay đổi nhanh
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
  }

  /**
   * Tạo cache key từ message và mode
   */
  generateKey(message, mode = "admission") {
    // Normalize message: lowercase, trim, remove extra spaces
    const normalized = message.toLowerCase().trim().replace(/\s+/g, " ");
    return `${mode}:${normalized}`;
  }

  /**
   * Get cached response
   */
  get(message, mode = "admission") {
    const key = this.generateKey(message, mode);
    const cache = this.modeCache[mode] || this.cache;
    const value = cache.get(key);

    if (value !== undefined) {
      this.stats.hits++;
      console.log(`✅ Cache HIT: "${message}" (mode: ${mode})`);
      return value;
    }

    this.stats.misses++;
    console.log(`❌ Cache MISS: "${message}" (mode: ${mode})`);
    return null;
  }

  /**
   * Set cached response
   */
  set(message, response, mode = "admission", ttl = null) {
    const key = this.generateKey(message, mode);
    const cache = this.modeCache[mode] || this.cache;

    if (ttl) {
      cache.set(key, response, ttl);
    } else {
      cache.set(key, response);
    }

    this.stats.sets++;
    console.log(`💾 Cache SET: "${message}" (mode: ${mode})`);
  }

  /**
   * Check if message has cached response
   */
  has(message, mode = "admission") {
    const key = this.generateKey(message, mode);
    const cache = this.modeCache[mode] || this.cache;
    return cache.has(key);
  }

  /**
   * Clear cache for a specific mode or all
   */
  clear(mode = null) {
    if (mode) {
      const cache = this.modeCache[mode];
      if (cache) {
        cache.flushAll();
        console.log(`🗑️  Cleared cache for mode: ${mode}`);
      }
    } else {
      this.cache.flushAll();
      Object.values(this.modeCache).forEach((cache) => cache.flushAll());
      console.log("🗑️  Cleared all caches");
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate =
      totalRequests > 0
        ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
        : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      totalRequests,
      hitRate: `${hitRate}%`,
      cacheKeys: {
        general: this.cache.keys().length,
        admission: this.modeCache.admission.keys().length,
        "student-support": this.modeCache["student-support"].keys().length,
        "web-search": this.modeCache["web-search"].keys().length,
      },
    };
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(mode = null) {
    if (mode) {
      const cache = this.modeCache[mode];
      return cache ? cache.keys() : [];
    }
    return this.cache.keys();
  }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;
