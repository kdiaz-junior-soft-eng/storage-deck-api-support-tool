// StorageDeckAPI/test/testGenerateJwt.ts
import { confirm } from "@inquirer/prompts";
import { getOrGenerateToken } from "../src/services/jwtService";
import { env } from "../src/config/env";

async function testGenerateJwt() {
  console.log("🔍 JWT GENERATION PREVIEW");
  console.log("==================================================================");
  console.log(`  Subject (User)    : ${env.JWT_SUB}`);
  console.log(`  User SRN          : ${env.JWT_USER_SRN}`);
  console.log(`  Tenant ID         : ${env.JWT_TENANT_ID}`);
  console.log(`  Tenant UUID       : ${env.JWT_TENANT_UUID}`);
  console.log(`  System Name (SN)  : ${env.JWT_SN}`);
  console.log(`  Expires In        : ${env.JWT_EXPIRES_IN}`);
  console.log("==================================================================\n");

  try {
    // Interactive confirmation defaulting to NO / false
    const shouldGenerate = await confirm({
      message: "Do you want to generate the signed JWT Bearer token with these details?",
      default: false,
    });

    if (!shouldGenerate) {
      console.log("\n⚠️ Token generation cancelled by user.");
      process.exit(0);
    }

    // Generate token only after explicit confirmation
    console.log("\n🔑 Generating JWT Bearer Token...");
    const rawToken = getOrGenerateToken();
    const bearerToken = `Bearer ${rawToken}`;

    console.log("\n🎫 GENERATED BEARER TOKEN:");
    console.log(bearerToken);
    console.log("\n------------------------------------------------------------------\n");

  } catch (error: any) {
    console.error("\n❌ Token generation failed:", error.message);
    process.exit(1);
  }
}

testGenerateJwt();