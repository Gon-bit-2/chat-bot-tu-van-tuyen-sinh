#!/usr/bin/env node

/**
 * Script test Phase 2 optimizations
 * Test compression, rate limiting, connection pool
 */

import axios from "axios";

const BASE_URL = "http://localhost:4321";
const TEST_TOKEN = "your-test-token-here"; // Thay bằng token thật

console.log("🧪 Testing Phase 2 Optimizations\n");

// Test 1: Compression
async function testCompression() {
  console.log("1️⃣  Testing Compression...");

  try {
    const response = await axios.get(`${BASE_URL}/v1/api/chat/modes`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        "Accept-Encoding": "gzip, deflate",
      },
    });

    const contentEncoding = response.headers["content-encoding"];
    const contentLength = response.headers["content-length"];

    if (contentEncoding === "gzip") {
      console.log("   ✅ Compression enabled");
      console.log(`   📦 Compressed size: ${contentLength} bytes`);
    } else {
      console.log("   ⚠️  Compression not detected");
    }
  } catch (error) {
    console.log("   ❌ Error:", error.message);
  }
}

// Test 2: Rate Limiting
async function testRateLimiting() {
  console.log("\n2️⃣  Testing Rate Limiting...");

  try {
    // Gửi 25 requests liên tiếp (limit là 20/phút)
    console.log("   Sending 25 rapid requests...");

    const requests = [];
    for (let i = 0; i < 25; i++) {
      requests.push(
        axios
          .get(`${BASE_URL}/v1/api/chat/modes`, {
            headers: { Authorization: `Bearer ${TEST_TOKEN}` },
          })
          .catch((err) => err.response)
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r?.status === 429);

    if (rateLimited.length > 0) {
      console.log(`   ✅ Rate limiting works`);
      console.log(`   🛡️  Blocked ${rateLimited.length}/25 requests`);
      console.log(
        `   📝 Message: ${
          rateLimited[0].data?.message || "Rate limit exceeded"
        }`
      );
    } else {
      console.log("   ⚠️  Rate limiting not detected (or limit is high)");
    }

    // Check headers
    const lastResponse = responses[responses.length - 1];
    if (lastResponse?.headers) {
      const limit = lastResponse.headers["x-ratelimit-limit"];
      const remaining = lastResponse.headers["x-ratelimit-remaining"];

      if (limit) {
        console.log(`   📊 Rate Limit: ${limit} requests`);
        console.log(`   ⏳ Remaining: ${remaining} requests`);
      }
    }
  } catch (error) {
    console.log("   ❌ Error:", error.message);
  }
}

// Test 3: MongoDB Connection Pool
async function testConnectionPool() {
  console.log("\n3️⃣  Testing MongoDB Connection Pool...");

  try {
    // Gửi 15 requests đồng thời để test pool
    console.log("   Sending 15 concurrent requests...");

    const startTime = Date.now();

    const requests = Array(15)
      .fill()
      .map((_, i) =>
        axios.get(`${BASE_URL}/v1/api/chat/conversations`, {
          headers: { Authorization: `Bearer ${TEST_TOKEN}` },
        })
      );

    const responses = await Promise.all(requests);
    const endTime = Date.now();

    const successCount = responses.filter((r) => r.status === 200).length;
    const avgTime = (endTime - startTime) / 15;

    console.log(`   ✅ ${successCount}/15 requests successful`);
    console.log(`   ⏱️  Average response time: ${avgTime.toFixed(0)}ms`);

    if (avgTime < 500) {
      console.log("   🚀 Connection pool working efficiently");
    } else {
      console.log("   ⚠️  Response time could be better");
    }
  } catch (error) {
    console.log("   ❌ Error:", error.message);
  }
}

// Test 4: Cache Stats
async function testCacheStats() {
  console.log("\n4️⃣  Testing Cache Stats API...");

  try {
    const response = await axios.get(`${BASE_URL}/v1/api/chat/cache-stats`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });

    if (response.data.success) {
      console.log("   ✅ Cache stats API working");
      console.log("   📊 Stats:", JSON.stringify(response.data.stats, null, 2));
    } else {
      console.log("   ⚠️  Cache stats not available");
    }
  } catch (error) {
    console.log("   ❌ Error:", error.message);
  }
}

// Run all tests
async function runTests() {
  try {
    await testCompression();
    await testRateLimiting();
    await testConnectionPool();
    await testCacheStats();

    console.log("\n🎉 All tests completed!\n");
    console.log("📝 Notes:");
    console.log("   - Replace TEST_TOKEN with a valid token");
    console.log("   - Make sure server is running on port 4321");
    console.log("   - Rate limiting test may take ~1 minute");
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
  }
}

// Check if axios is available
try {
  await runTests();
} catch (error) {
  if (error.code === "ERR_MODULE_NOT_FOUND") {
    console.log("❌ axios not found. Install it first:");
    console.log("   npm install axios");
  } else {
    console.error("Error:", error.message);
  }
}
