// StorageDeckAPI/test/generateJwtTest.ts
import { getOrGenerateToken } from "../src/services/jwtService";
import { env } from "../src/config/env";

function testGenerateJwt() {
  console.log("🔑 Generating JWT Bearer Token...\n");

  try {
    // 1. Generate token from environment configuration
    const rawToken = getOrGenerateToken();
    const bearerToken = `Bearer ${rawToken}`;

    // 2. Log user details sourced from environment config
    console.log("👤 USER & TENANT CONTEXT FOR TOKEN");
    console.log("------------------------------------------------------------------");
    console.log(`  Subject (User)    : ${env.JWT_SUB}`);
    console.log(`  User SRN          : ${env.JWT_USER_SRN}`);
    console.log(`  Tenant ID         : ${env.JWT_TENANT_ID}`);
    console.log(`  Tenant UUID       : ${env.JWT_TENANT_UUID}`);
    console.log(`  System Name (SN)  : ${env.JWT_SN}`);
    console.log(`  Expires In        : ${env.JWT_EXPIRES_IN}`);
    console.log("------------------------------------------------------------------\n");

    // 3. Log generated token
    console.log("🎫 GENERATED BEARER TOKEN:");
    console.log(bearerToken);
    console.log("\n------------------------------------------------------------------\n");

  } catch (error: any) {
    console.error("❌ Token generation failed:", error.message);
    process.exit(1);
  }
}

testGenerateJwt();