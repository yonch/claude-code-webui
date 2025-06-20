#!/usr/bin/env node

import { spawn } from "child_process";
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "fs";
import { join } from "path";
import {
  DEMO_SCENARIOS,
  type DemoScenario,
  type Theme,
  type RecordingOptions,
} from "./demo-constants";

/**
 * Demo recording script
 * This script runs Playwright tests to record demo videos
 */

function createOutputDir(): string {
  const outputDir = join(process.cwd(), "demo-recordings");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }
  return outputDir;
}

function copyVideoFromTestResults(scenario: DemoScenario, theme: Theme): void {
  const outputDir = createOutputDir();
  const testResultsDir = join(process.cwd(), "test-results");

  if (!existsSync(testResultsDir)) {
    console.log("⚠️ No test-results directory found");
    return;
  }

  // Find the most recent test result directory for this scenario
  const dirs = readdirSync(testResultsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .filter((dirent) => dirent.name.includes(`record-${scenario}-demo`))
    .map((dirent) => ({
      name: dirent.name,
      path: join(testResultsDir, dirent.name),
    }))
    .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (newest first)

  if (dirs.length === 0) {
    console.log(`⚠️ No test results found for scenario: ${scenario}`);
    return;
  }

  const latestDir = dirs[0];
  const videoPath = join(latestDir.path, "video.webm");

  if (!existsSync(videoPath)) {
    console.log(`⚠️ No video file found in: ${latestDir.path}`);
    return;
  }

  // Create output filename with theme suffix
  const themeLabel = theme !== "light" ? `-${theme}` : "";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputFilename = `${scenario}${themeLabel}-${timestamp}.webm`;
  const outputPath = join(outputDir, outputFilename);

  try {
    copyFileSync(videoPath, outputPath);
    console.log(`📹 Video saved: ${outputFilename}`);
  } catch (error) {
    console.error(`❌ Failed to copy video: ${error}`);
  }
}

function runPlaywrightTest(options: RecordingOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { scenario, theme } = options;
    const themeLabel = theme !== "light" ? ` (${theme})` : "";
    console.log(`🎬 Recording demo scenario: ${scenario}${themeLabel}`);

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
        DEMO_THEME: theme,
        DEMO_OUTPUT_DIR: createOutputDir(),
      },
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Successfully recorded ${scenario} demo${themeLabel}`);

        // Copy video from test-results to demo-recordings
        copyVideoFromTestResults(scenario, theme);

        resolve();
      } else {
        console.error(
          `❌ Failed to record ${scenario} demo${themeLabel} (exit code: ${code})`,
        );
        reject(new Error(`Recording failed for ${scenario}${themeLabel}`));
      }
    });

    child.on("error", (error) => {
      console.error(`❌ Error running Playwright: ${error.message}`);
      reject(error);
    });
  });
}

function parseArguments(): RecordingOptions {
  const args = process.argv.slice(2);
  let scenario: DemoScenario = "codeGeneration";
  let theme: Theme = "light";

  // Parse scenario (first positional argument)
  if (args[0] && DEMO_SCENARIOS.includes(args[0] as DemoScenario)) {
    scenario = args[0] as DemoScenario;
  } else if (args[0] === "all") {
    // Special case handled in main()
  }

  // Parse --theme option
  const themeArg = args.find((arg) => arg.startsWith("--theme="));
  if (themeArg) {
    const themeValue = themeArg.split("=")[1] as Theme;
    if (["light", "dark", "both"].includes(themeValue)) {
      theme = themeValue;
    }
  }

  return { scenario, theme };
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArguments();

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
    const firstArg = args[0];

    if (firstArg === "all") {
      // Record all scenarios
      const themeLabel = options.theme !== "light" ? ` (${options.theme})` : "";
      console.log(
        `📝 Recording all ${DEMO_SCENARIOS.length} demo scenarios${themeLabel}...`,
      );

      if (options.theme === "both") {
        // Record both themes for all scenarios
        for (const scenario of DEMO_SCENARIOS) {
          await runPlaywrightTest({ scenario, theme: "light" });
          await runPlaywrightTest({ scenario, theme: "dark" });
        }
      } else {
        // Record single theme for all scenarios
        for (const scenario of DEMO_SCENARIOS) {
          await runPlaywrightTest({ scenario, theme: options.theme });
        }
      }
    } else {
      // Record specific scenario (or default)
      if (options.theme === "both") {
        // Record both themes for the scenario
        await runPlaywrightTest({ scenario: options.scenario, theme: "light" });
        await runPlaywrightTest({ scenario: options.scenario, theme: "dark" });
      } else {
        // Record single theme
        await runPlaywrightTest(options);
      }
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
// ES Module compatible execution check
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/record-demo.ts")
) {
  main().catch(console.error);
}

export { runPlaywrightTest };
