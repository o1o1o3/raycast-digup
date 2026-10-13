# Contributing

Small, focused improvements are welcome. Open an issue to discuss substantial behavior changes before implementing them.

## Local workflow

1. Fork the repository and create a branch from `main`.
2. Use the Node version in `.nvmrc` and run `npm ci`.
3. Make the change, adding regression coverage for nontrivial behavior.
4. Run `npm run check` and `npm run bundle`.
5. Open a pull request explaining the problem, resulting behavior, and validation.

Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit and PR titles, for example `fix(search): discard obsolete results`. Keep changes focused. Use `npm run format` to apply formatting.

## Testing

Build generates `raycast-env.d.ts`, which is intentionally not committed. Tests exercise protocol framing, errors, request correlation, process cleanup, folder boundaries, result locations and plist parsing. They must not read a contributor's real index or require DigUp.

For UI or engine compatibility changes, also test locally with DigUp and Raycast. Report tested versions and whether semantic search was active. Never attach real file contents, private paths or raw logs without reviewing them first. Use synthetic examples for screenshots.

## Project boundaries

- Preserve configured roots and exclusions; do not infer additional scope.
- Keep queries and document contents local.
- Pass process arguments as arrays; never interpolate queries into shell commands.
- Close command-owned processes and reject pending requests on shutdown.
- Keep secret-bearing configuration, model files, indexes and generated bundles out of Git.

## Review and releases

Pull requests must pass CI and resolve review conversations. The maintainer uses squash merges into `main`. Releases follow the procedure in [docs/releasing.md](docs/releasing.md); dependency updates are reviewed, not automatically merged.

Be respectful, constructive and specific in discussions. Harassment, personal attacks and disclosure of others' private information are not acceptable. The maintainer may remove abusive content or limit participation.
