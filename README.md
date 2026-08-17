# Manifest

Automated static publishing workspace.

This README intentionally contains only the public development contract.
Environment-specific inputs, operational configuration, and deployment details
are managed outside this document.

## Requirements

- Node.js 24
- npm

## Local verification

```bash
npm ci
npm test
npm run check
npm run build
```

## Configuration

Runtime values are supplied through environment variables and repository-level
variables or secrets. Do not commit credentials, private endpoints, or local
overrides.

## Repository policy

Generated files are maintained by automation. Change source files and scripts,
verify them locally, and use the repository checks as the delivery gate.
