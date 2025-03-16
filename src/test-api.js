/**
 * Test script to verify API connectivity
 * Run with: node src/test-api.js
 */

const axios = require("axios");

const API_BASE_URL = "http://localhost:5432";

const testEndpoints = async () => {
  console.log("=== WOLVESVILLE API CONNECTIVITY TEST ===");

  try {
    // Test root endpoint
    console.log("\nTesting root endpoint...");
    const rootResponse = await axios.get(API_BASE_URL);
    console.log("✅ Root endpoint:", rootResponse.data);

    // Test user registration
    console.log("\nTesting user registration...");
    const registerData = {
      username: "testuser" + Math.floor(Math.random() * 1000),
      email: `test${Math.floor(Math.random() * 1000)}@example.com`,
      password: "password123",
    };

    try {
      const registerResponse = await axios.post(
        `${API_BASE_URL}/api/users/register`,
        registerData
      );
      console.log("✅ Registration successful:", registerResponse.data.message);
      console.log(
        "Token received:",
        registerResponse.data.token ? "✅ Yes" : "❌ No"
      );

      // Save token for next tests
      const token = registerResponse.data.token;

      // Test protected endpoint with token
      if (token) {
        console.log("\nTesting protected endpoint...");
        try {
          const meResponse = await axios.get(`${API_BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log(
            "✅ Protected endpoint access successful:",
            meResponse.data.user.username
          );
        } catch (err) {
          console.log("❌ Protected endpoint access failed:", err.message);
        }
      }
    } catch (err) {
      console.log(
        "❌ Registration failed:",
        err.response?.data?.message || err.message
      );
    }

    // Test games endpoint
    console.log("\nTesting games endpoint...");
    try {
      const gamesResponse = await axios.get(`${API_BASE_URL}/api/games`);
      console.log(
        `✅ Games endpoint returned ${gamesResponse.data.games.length} games`
      );
    } catch (err) {
      console.log("❌ Games endpoint failed:", err.message);
    }
  } catch (err) {
    console.log("❌ Root endpoint failed:", err.message);
    console.log(
      "\n⚠️ API may not be running. Please start the server with: npm run server"
    );
  }

  console.log("\n=== TEST COMPLETED ===");
};

testEndpoints();
