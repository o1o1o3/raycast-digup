# Security policy

## Supported versions

Security fixes target the latest published release. Earlier versions should be upgraded.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/o1o1o3/raycast-digup/security/advisories/new). Do not publish exploitable details in a public issue. Include the affected version, a minimal synthetic reproduction, impact and any suggested mitigation. Do not include private documents, tokens or a real index.

This is a community-maintained project; response times are not guaranteed.

## Trust boundaries

The extension executes the helper inside the DigUp application selected in preferences. Only select a trusted DigUp installation. DigUp, its models and Raycast are separate dependencies; report vulnerabilities in those products to their maintainers.

Search requests travel through local pipes. The helper reads the configured local index and loads an on-device model. The extension filters returned paths against configured roots and exclusions, but is not a filesystem sandbox and cannot restrict a compromised helper. macOS permissions remain authoritative.

The extension does not implement analytics, a network search service, arbitrary shell execution from queries, or keyboard hooks. Built-in open/reveal/clipboard actions operate only when invoked. Review clipboard contents before sharing them.
