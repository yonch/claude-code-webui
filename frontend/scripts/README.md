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

### Available Scenarios

- **Basic**: `npm run record-demo:basic`
- **Code Generation**: `npm run record-demo:code`
- **Debugging**: `npm run record-demo:debug`
- **File Operations**: `npm run record-demo:files`
- **All Scenarios**: `npm run record-demo:all`

### Manual Recording

Run Playwright tests directly:
```bash
npm run test:demo
```

## Output

- Videos are saved to `demo-recordings/` directory
- Format: MP4 (1280x720, 30fps)
- Automatic completion detection using `data-demo-completed` attribute

## How It Works

1. **Playwright Configuration**: `playwright.config.ts` sets up video recording
2. **Test Specs**: `demo-recorder.spec.ts` contains the recording tests
3. **Recording Script**: `record-demo.ts` orchestrates the recording process
4. **Demo Detection**: Waits for `[data-demo-completed="true"]` to stop recording

## Troubleshooting

- **Recording doesn't start**: Ensure dev server is running on port 3000
- **Demo doesn't complete**: Check demo automation in the browser console
- **Quality issues**: Adjust video settings in `playwright.config.ts`
- **Timeout errors**: Increase timeout values for slower demos

## Demo URL Format

The recorder uses URLs like:
```
http://localhost:3000/demo?scenario=codeGeneration
```

Available scenarios: `basic`, `codeGeneration`, `debugging`, `fileOperations`