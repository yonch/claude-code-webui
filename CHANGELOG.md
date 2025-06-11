# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Pull request based development workflow
- Changelog tracking for better release management

## [0.1.3] - 2025-06-11

### Added

- True single binary distribution with embedded frontend assets
- Command line interface with `--port`, `--help`, `--version` options
- Startup validation to check Claude CLI availability
- Cross-platform automated releases for Linux (x64/ARM64), macOS (x64/ARM64), Windows (x64)
- GitHub Actions workflow for automated releases on git tags
- Comprehensive documentation for installation and usage

### Changed

- Migrated from basic HTTP handler to Hono framework for better middleware support
- Frontend assets are now bundled into the binary for self-contained execution
- Updated release workflow to use softprops/action-gh-release@v2 with proper permissions

### Fixed

- Windows build issues in GitHub Actions (PowerShell multiline command parsing)
- Release workflow permissions (added `contents: write`)
- Test warnings and errors by mocking fetch API
- TypeScript lint errors in test files

## [0.1.0] - 2025-06-11

### Added

- Initial web-based interface for Claude CLI tool
- Real-time streaming response display
- React frontend with TailwindCSS styling
- Deno backend with TypeScript
- Support for different Claude message types (system, assistant, result)
- Dark/light theme toggle
- Comprehensive test suite with Vitest and Testing Library
- CI/CD pipeline with GitHub Actions

### Technical Details

- Backend serves on port 8080 (configurable)
- Frontend serves on port 3000 in development
- Uses WebSocket-like streaming for real-time responses
- Executes `claude --output-format stream-json --verbose -p <message>`
- Cross-platform support (Linux, macOS, Windows)

[Unreleased]: https://github.com/sugyan/claude-code-webui/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/sugyan/claude-code-webui/compare/v0.1.0...v0.1.3
[0.1.0]: https://github.com/sugyan/claude-code-webui/releases/tag/v0.1.0
