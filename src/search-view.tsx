import {
  Action,
  ActionPanel,
  Icon,
  List,
  getPreferenceValues,
  openExtensionPreferences,
  type LaunchProps,
  Keyboard,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { ServiceClient } from "./lib/service";
import { readSettings, serviceArguments } from "./lib/settings";
import {
  editorTarget,
  locationLabel,
  parseHits,
  type SearchHit,
} from "./lib/results";

type Mode = "code" | "files" | "screenshots";
const titles: Record<Mode, string> = {
  code: "Search Code",
  files: "Search Files",
  screenshots: "Search Screenshots",
};
const placeholders: Record<Mode, string> = {
  code: "Describe a function or enter a symbol…",
  files: "Describe a document, photo, recording or video…",
  screenshots: "Describe a screenshot or the text it contains…",
};

function shortPath(path: string) {
  return path.startsWith(homedir() + "/")
    ? "~/" + path.slice(homedir().length + 1)
    : path;
}
function preview(hit: SearchHit) {
  const title = basename(hit.path).replace(/[\\`*_[\]<>]/g, "\\$&");
  if (["image", "screenshot"].includes(hit.kind))
    return `## ${title}\n\n![Preview](${pathToFileURL(hit.path).href})`;
  // Treat excerpts as text: a document's Markdown must not load remote images.
  const excerpt = (
    hit.excerpt ?? "No text excerpt is available for this match."
  ).replace(/`/g, "ˋ");
  return `## ${title}\n\n${locationLabel(hit)}\n\n\`\`\`text\n${excerpt}\n\`\`\``;
}

export default function SearchView({
  mode,
  launchProps,
}: {
  mode: Mode;
  launchProps: LaunchProps;
}) {
  const preferences = getPreferenceValues<Preferences>();
  const app = preferences.applicationPath?.path || "/Applications/DigUp.app";
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(launchProps.fallbackText ?? "");
  const [kind, setKind] = useState("");
  const [client, setClient] = useState<ServiceClient>();
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [meaning, setMeaning] = useState(false);
  const [warning, setWarning] = useState<string>();
  const config = useMemo(() => {
    // Re-read app settings on Retry after the user changes folders in DigUp.
    void revision;
    try {
      return { settings: readSettings(app), error: undefined };
    } catch (e) {
      return {
        settings: undefined,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [app, revision]);
  const settings = config.settings;
  const roots = mode === "code" ? settings?.codeRoots : settings?.roots;
  const exclusions =
    mode === "code" ? settings?.codeExcluded : settings?.excluded;
  const noFolders = !!settings && !roots?.length;

  useEffect(() => {
    setClient(undefined);
    setError(undefined);
    setHits([]);
    setWarning(undefined);
    if (!settings || !roots?.length) return;
    if (
      !existsSync(
        join(settings.index, mode === "code" ? "code.sqlite" : "index.sqlite"),
      )
    ) {
      setError(
        "The index is not ready. Let DigUp start indexing, then choose Retry.",
      );
      return;
    }
    const service = new ServiceClient(
      settings.binary,
      serviceArguments(settings),
      { env: { DIGUP_MODELS: settings.models } },
    );
    let disposed = false;
    void service
      .request({ op: "status" })
      .then(() => {
        if (!disposed) setClient(service);
      })
      .catch((e: unknown) => {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      disposed = true;
      service.close();
    };
  }, [settings, mode, roots]);

  useEffect(() => {
    let obsolete = false;
    const trimmed = query.trim();
    const text = mode === "code" ? trimmed.replace(/^code:\s*/i, "") : trimmed;
    setHits([]);
    setWarning(undefined);
    setMeaning(false);
    if (!client || !text) {
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(undefined);
    const timer = setTimeout(async () => {
      try {
        await client.request({ op: "reload" });
        if (obsolete) return;
        const reply = await client.request({
          op: "search",
          q: text,
          code: mode === "code",
          meaning: true,
          limit: 60,
          ...(mode === "screenshots"
            ? { kinds: ["screenshot"] }
            : kind
              ? { kinds: [kind] }
              : {}),
        });
        if (obsolete) return;
        setHits(parseHits(reply, roots ?? [], exclusions ?? []));
        setMeaning(reply.meaning === true);
        setWarning(
          typeof reply.warning === "string" ? reply.warning : undefined,
        );
      } catch (e) {
        if (!obsolete) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!obsolete) setBusy(false);
      }
    }, 350);
    return () => {
      obsolete = true;
      clearTimeout(timer);
    };
  }, [client, query, kind, mode, roots, exclusions]);

  const problem = config.error ?? error;
  const actions = (hit?: SearchHit) => (
    <ActionPanel>
      {hit && (
        <ActionPanel.Section>
          <Action.Open
            title={
              hit.kind === "code" && preferences.codeEditor !== "default"
                ? "Open in Editor"
                : "Open File"
            }
            target={editorTarget(hit, preferences.codeEditor ?? "default")}
          />
          <Action.ShowInFinder
            path={hit.path}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
          />
          <Action.CopyToClipboard
            title="Copy File Path"
            content={hit.path}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          {hit.excerpt && (
            <Action.CopyToClipboard
              title="Copy Matching Text"
              content={hit.excerpt}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          )}
          <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
        </ActionPanel.Section>
      )}
      <ActionPanel.Section>
        <Action
          title="Retry / Reload Settings"
          icon={Icon.ArrowClockwise}
          onAction={() => setRevision((v) => v + 1)}
          shortcut={Keyboard.Shortcut.Common.Refresh}
        />
        <Action.Open title="Open DigUp" target={app} />
        <Action
          title="Extension Preferences"
          icon={Icon.Gear}
          onAction={openExtensionPreferences}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
  const emptyTitle = problem
    ? "DigUp Needs Attention"
    : noFolders
      ? "Choose Folders in DigUp"
      : busy
        ? "Searching…"
        : query.trim()
          ? "No Matches Yet"
          : "Search Your Local Index";
  const emptyDescription =
    problem ??
    (noFolders
      ? mode === "code"
        ? "Enable code search and add folders in DigUp Settings → Code."
        : "Add folders in DigUp Settings. Files and screenshots share its main index."
      : query.trim()
        ? "Try an exact name or a different description. New files appear as DigUp indexes them."
        : placeholders[mode]);

  return (
    <List
      navigationTitle={`DigUp · ${titles[mode]}`}
      searchBarPlaceholder={placeholders[mode]}
      searchText={query}
      onSearchTextChange={setQuery}
      filtering={false}
      isLoading={busy}
      isShowingDetail={hits.length > 0}
      searchBarAccessory={
        mode === "files" ? (
          <List.Dropdown tooltip="File Type" value={kind} onChange={setKind}>
            {[
              ["", "All Files"],
              ["doc", "Documents"],
              ["pdf", "PDFs"],
              ["image", "Images"],
              ["screenshot", "Screenshots"],
              ["audio", "Audio"],
              ["video", "Video"],
            ].map(([value, title]) => (
              <List.Dropdown.Item key={value} value={value} title={title} />
            ))}
          </List.Dropdown>
        ) : undefined
      }
    >
      <List.EmptyView
        title={emptyTitle}
        description={emptyDescription}
        icon={problem ? Icon.ExclamationMark : Icon.MagnifyingGlass}
        actions={actions()}
      />
      <List.Section
        title={meaning ? "Meaning + Keywords" : "Keywords Only"}
        subtitle={
          warning ??
          (!meaning && hits.length
            ? "Semantic model unavailable; open DigUp to check its download."
            : `${hits.length} matches`)
        }
      >
        {hits.map((hit) => (
          <List.Item
            key={`${hit.path}:${hit.segment_id}`}
            id={String(hit.segment_id)}
            title={basename(hit.path)}
            subtitle={locationLabel(hit)}
            icon={{ fileIcon: hit.path }}
            quickLook={{ path: hit.path, name: basename(hit.path) }}
            detail={
              <List.Item.Detail
                markdown={preview(hit)}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label
                      title="Folder"
                      text={shortPath(dirname(hit.path))}
                    />
                    <List.Item.Detail.Metadata.Label
                      title="Type"
                      text={hit.kind}
                    />
                    {locationLabel(hit) && (
                      <List.Item.Detail.Metadata.Label
                        title="Match"
                        text={locationLabel(hit)}
                      />
                    )}
                    <List.Item.Detail.Metadata.Label
                      title="Search"
                      text={
                        meaning
                          ? "On-device semantic search"
                          : "Exact words only"
                      }
                    />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={actions(hit)}
          />
        ))}
      </List.Section>
    </List>
  );
}
