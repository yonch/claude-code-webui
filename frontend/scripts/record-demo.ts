#!/usr/bin/env node

import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Demo recording script
 * This script runs Playwright tests to record demo videos
 */

const DEMO_SCENARIOS = [
  "basic",
  "codeGeneration",
  "debugging",
  "fileOperations",
] as const;

type DemoScenario = (typeof DEMO_SCENARIOS)[number];

function createOutputDir(): string {
  const outputDir = join(process.cwd(), "demo-recordings");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }
  return outputDir;
}

function runPlaywrightTest(scenario: DemoScenario): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`🎬 Recording demo scenario: ${scenario}`);

    const args = [
      "test",
      "--config",
      "playwright.config.ts",
      "--grep",
      `record ${scenario} demo`,
      "--project",
      "chromium",
    ];

    const child = spawn("npx", ["playwright", ...args], {
      stdio: "inherit",
      env: {
        ...process.env,
        DEMO_SCENARIO: scenario,
        DEMO_OUTPUT_DIR: createOutputDir(),
      },
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Successfully recorded ${scenario} demo`);
        resolve();
      } else {
        console.error(
          `❌ Failed to record ${scenario} demo (exit code: ${code})`,
        );
        reject(new Error(`Recording failed for ${scenario}`));
      }
    });

    child.on("error", (error) => {
      console.error(`❌ Error running Playwright: ${error.message}`);
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args[0] as DemoScenario;

  console.log("🎥 Claude Code Web UI Demo Recorder");
  console.log("=====================================");

  // Check if Playwright is installed
  try {
    await new Promise((resolve, reject) => {
      const child = spawn("npx", ["playwright", "--version"], {
        stdio: "pipe",
      });
      child.on("close", (code) => {
        if (code === 0) resolve(undefined);
        else reject(new Error("Playwright not found"));
      });
      child.on("error", reject);
    });
  } catch {
    console.error("❌ Playwright not found. Please install it first:");
    console.error("   npm install");
    console.error("   npx playwright install");
    process.exit(1);
  }

  try {
    if (scenarioArg && DEMO_SCENARIOS.includes(scenarioArg)) {
      // Record specific scenario
      await runPlaywrightTest(scenarioArg);
    } else if (scenarioArg === "all") {
      // Record all scenarios
      console.log(
        `📝 Recording all ${DEMO_SCENARIOS.length} demo scenarios...`,
      );
      for (const scenario of DEMO_SCENARIOS) {
        await runPlaywrightTest(scenario);
      }
    } else {
      // Default to codeGeneration scenario
      console.log("📝 No scenario specified, recording codeGeneration demo...");
      await runPlaywrightTest("codeGeneration");
    }

    console.log("🎉 Demo recording completed successfully!");
    console.log(`📹 Videos saved to: ${createOutputDir()}`);
  } catch (error) {
    console.error(
      "❌ Demo recording failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runPlaywrightTest, DEMO_SCENARIOS };
