# Releasing

1. Merge the intended changes through a pull request and wait for CI on `main` to pass.
2. Update `package.json`, `package-lock.json` and `CHANGELOG.md` together for the next semantic version. Review dependency updates and run `npm audit`.
3. Confirm a manual search in Raycast with the documented DigUp version. Verify keyword and semantic search, configured exclusions, opening a result, and shutdown.
4. Download the `digup-local` artifact from the successful CI run for the release commit. It includes the bundle and `SHA256SUMS`. Verify the checksum.
5. Create an annotated `vX.Y.Z` tag at that exact commit and push it.
6. Create a GitHub release for the tag, attaching `digup-local.rayext` and `SHA256SUMS`. Describe changes and known compatibility limits. Do not upload a local index, model or configuration.

CI only builds artifacts; it has no permission to publish releases. Release publication is a deliberate maintainer action. Do not reuse or move published version tags.
