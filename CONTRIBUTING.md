# Contributing Guide

Thank you for your interest in contributing to the Stellar Price Oracle Backend! This guide will help you get started.

## Project Structure

The project is organized into two main components:

- **`aggregator/`** - Off-chain service that polls oracle sources and submits data
- **`api/`** - REST + WebSocket API for price feed consumers

## Getting Started

1. **Fork and clone** the repository
2. **Install dependencies** - See README.md for setup instructions
3. **Create a feature branch** - `git checkout -b feature/your-feature`
4. **Make your changes** - Follow the coding standards below
5. **Test thoroughly** - Run tests before submitting
6. **Submit a pull request** - Include a clear description of changes

## Coding Standards

### TypeScript
- Use `prettier` for formatting
- Run `eslint` for linting
- Maintain 80%+ test coverage
- Use meaningful variable and function names

## Issue Labels

- `good-first-issue` - Great for newcomers
- `help-wanted` - Community contributions welcome
- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Docs or examples

## Testing

Before submitting a PR:

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Format code
npm run format
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Keep commits atomic and well-described
5. Reference any related issues

## Questions?

- Check existing issues and discussions
- Open a new discussion for questions
- Review the architecture documentation in `docs/`

## Code of Conduct

Be respectful and constructive. We're building together.
