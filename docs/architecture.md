# Architecture

## Data flow

`search-code`, `search-files` and `search-screenshots` mount a shared `SearchView`. `open-digup` opens the selected application.

1. `settings.ts` reads DigUp's macOS preferences using `defaults export`, parses the plist and resolves configured paths.
2. `ServiceClient` spawns the application's helper using an argument array and passes the model directory through its environment.
3. The UI sends a status handshake, then debounced reload/search requests. It ignores results from obsolete queries.
4. `results.ts` validates returned hits and filters them against the relevant roots and exclusions before display.

## Process lifetime

The transport correlates numeric request IDs, assembles JSON lines and ignores unsolicited startup messages. Helper errors, invalid output, process exits and timeouts reject pending calls. The helper has a private process group; closing the command ends stdin and allows a 3.5-second shutdown grace period before signalling the group. It does not terminate the independent DigUp app or indexer.

## Ownership

DigUp owns indexing, supported formats, exclusions, model downloads and file monitoring. Raycast owns the command UI. The extension owns only its query transport, preferences adapter and result presentation. It does not maintain a second index.

## Limitations

Compatibility is verified against DigUp 0.6.1's bundled helper, not a versioned public API guarantee. New engine versions may require adapter changes. Files discovered by the indexer may appear before their content is processed. Only code editor links use exact locations; PDFs and media open with the default application. The helper may fall back to keyword search if semantic encoding is unavailable.

Automated tests use synthetic paths and a fixture helper. End-to-end validation requires a real macOS installation and remains a manual check.
