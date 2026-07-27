// StorageDeckAPI/test/generate1000FilesTest.ts
import { generateBatchTestTxtFiles } from "../src/services";

/**
 * Terminal spinner helper to give visual feedback during mass generation.
 */
function createSpinner(message: string) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let index = 0;

  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[index]} ${message}`);
    index = (index + 1) % frames.length;
  }, 80);

  return {
    stop: (finalMessage?: string) => {
      clearInterval(interval);
      process.stdout.write("\r\x1b[K");
      if (finalMessage) console.log(finalMessage);
    },
  };
}

async function run() {
  const FILE_COUNT = 50000;
  console.log(`🚀 Starting mass generation of ${FILE_COUNT} test files...\n`);

  const startTime = Date.now();
  const spinner = createSpinner(`Generating ${FILE_COUNT} files in temp_test_files/...`);

  // Generate 1,000 files in parallel using the service
  const files = await generateBatchTestTxtFiles(FILE_COUNT, {
    prefix: "perf_test_doc",
  });

  const durationMs = Date.now() - startTime;
  spinner.stop(`✅ Successfully generated ${files.length} unique files!`);

  console.log("\n📊 GENERATION SUMMARY");
  console.log("------------------------------------------------------------------");
  console.log(`  File Count    : ${files.length.toLocaleString()} files`);
  console.log(`  Location      : ${files[0].filePath.split(files[0].fileName)[0]}`);
  console.log(`  Time Elapsed  : ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`  First File    : ${files[0].fileName}`);
  console.log(`  Last File     : ${files[files.length - 1].fileName}`);
  console.log("------------------------------------------------------------------\n");
}

run().catch((err) => {
  console.error("❌ File generation failed:", err);
  process.exit(1);
});