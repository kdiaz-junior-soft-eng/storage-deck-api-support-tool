// StorageDeckAPI/test/decodeJwtTest.ts
import { input } from "@inquirer/prompts";
import { decodeJwtToken } from "../src/services/jwtService";

async function run() {
  try {
    // Force user input from the terminal so no real tokens live in source control
    const userToken = await input({
      message: "Paste the JWT token you want to decode:",
      validate: (value) => (value.trim().length > 0 ? true : "Token cannot be empty."),
    });

    console.log("\n🔓 Decoding JWT Token...\n");

    const result = decodeJwtToken(userToken);

    console.log("Header:");
    console.log(JSON.stringify(result.header, null, 2));

    console.log("\nPayload:");
    console.log(JSON.stringify(result.payload, null, 2));

    console.log("\nToken Status:");
    console.log(`  Expired?    : ${result.isExpired ? "❌ Yes" : "✅ No"}`);
    if (result.expiresAt) {
      console.log(`  Expires On  : ${result.expiresAt.toISOString()}`);
    }
  } catch (error: any) {
    console.error("❌ Error decoding token:", error.message);
  }
}

run();