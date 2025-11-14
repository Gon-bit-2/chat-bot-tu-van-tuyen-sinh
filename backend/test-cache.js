#!/usr/bin/env node

/**
 * Script kiểm tra performance của chatbot
 * Chạy: node test-performance.js
 */

import cacheService from "./src/utils/cache.service.js";

console.log("🧪 Test Cache Service\n");

// Test 1: Set và Get
console.log("1️⃣  Test cache set/get...");
const testMessage = "học phí ngành công nghệ thông tin";
const testResponse = "Học phí ngành Công nghệ thông tin là 15.204.000đ/học kỳ";

cacheService.set(testMessage, testResponse, "admission");
const cached = cacheService.get(testMessage, "admission");

if (cached === testResponse) {
  console.log("   ✅ Cache set/get hoạt động tốt");
} else {
  console.log("   ❌ Cache có vấn đề");
}

// Test 2: Cache hit/miss
console.log("\n2️⃣  Test cache hit/miss...");
cacheService.get(testMessage, "admission"); // Hit
cacheService.get("câu hỏi chưa có", "admission"); // Miss

const stats = cacheService.getStats();
console.log("   Stats:", stats);

if (stats.hits === 1 && stats.misses === 1) {
  console.log("   ✅ Cache tracking hoạt động tốt");
} else {
  console.log("   ❌ Cache tracking có vấn đề");
}

// Test 3: Cache keys
console.log("\n3️⃣  Test cache keys...");
const keys = cacheService.getKeys("admission");
console.log(`   Found ${keys.length} cached items in admission mode`);

if (keys.length > 0) {
  console.log("   ✅ Cache keys hoạt động tốt");
} else {
  console.log("   ⚠️  Không có cached items (có thể do clear cache)");
}

// Test 4: Clear cache
console.log("\n4️⃣  Test clear cache...");
cacheService.clear("admission");
const keysAfterClear = cacheService.getKeys("admission");

if (keysAfterClear.length === 0) {
  console.log("   ✅ Clear cache hoạt động tốt");
} else {
  console.log("   ❌ Clear cache có vấn đề");
}

// Final stats
console.log("\n📊 Final Statistics:");
console.log(cacheService.getStats());

console.log("\n🎉 Test hoàn tất!\n");
