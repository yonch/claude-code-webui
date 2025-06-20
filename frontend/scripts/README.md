# Demo Recording Scripts

This directory contains Playwright-based scripts for automatically recording demo videos of the Claude Code Web UI.

## Setup

1. Install dependencies:

   ```bash
   npm install
   npm run playwright:install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Recording Demos

### Quick Start

Record the default codeGeneration demo:

```bash
npm run record-demo
```

### Quick Commands

- **Default (Light Mode)**: `npm run record-demo`
- **Dark Mode**: `npm run record-demo:dark`

### Advanced Usage

Use the script directly for more control:

```bash
# Specific scenarios
npx tsx scripts/record-demo.ts basic
npx tsx scripts/record-demo.ts codeGeneration
npx tsx scripts/record-demo.ts debugging
npx tsx scripts/record-demo.ts fileOperations

# Theme options
npx tsx scripts/record-demo.ts codeGeneration --theme=light
npx tsx scripts/record-demo.ts codeGeneration --theme=dark
npx tsx scripts/record-demo.ts codeGeneration --theme=both

# Record all scenarios
npx tsx scripts/record-demo.ts all --theme=dark
npx tsx scripts/record-demo.ts all --theme=both
```

### Manual Recording

Run Playwright tests directly:

```bash
npm run test:demo
```

## Output

- Videos are saved to `demo-recordings/` directory
- Format: WebM (1280x720, 25fps)
- Automatic completion detection using `data-demo-completed` attribute

## How It Works

1. **Shared Constants**: `demo-constants.ts` defines scenarios and types
2. **Playwright Configuration**: `playwright.config.ts` sets up video recording
3. **Recording Tests**: `demo-recorder.spec.ts` contains the recording logic
4. **Recording Script**: `record-demo.ts` orchestrates the recording process
5. **Validation Tests**: `../tests/demo-validation.spec.ts` validates demo functionality
6. **Demo Detection**: Waits for `[data-demo-completed="true"]` to stop recording

## Troubleshooting

- **Recording doesn't start**: Ensure dev server is running on port 3000
- **Demo doesn't complete**: Check demo automation in the browser console
- **Quality issues**: Adjust video settings in `playwright.config.ts`
- **Timeout errors**: Increase timeout values for slower demos

## Demo URL Format

The recorder uses URLs like:

```
http://localhost:3000/demo?scenario=codeGeneration&theme=dark
```

Available parameters:

- **scenario**: `basic`, `codeGeneration`, `debugging`, `fileOperations`
- **theme**: `light`, `dark` (optional, defaults to light)
