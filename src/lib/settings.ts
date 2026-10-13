import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "plist";

export type DigUpSettings = {
  app: string;
  binary: string;
  index: string;
  models: string;
  roots: string[];
  excluded: string[];
  types: string[];
  codeRoots: string[];
  codeExcluded: string[];
};

export function parsePreferences(xml: string): Record<string, unknown> {
  const value = parse(xml);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Could not parse DigUp preferences");
  return value as Record<string, unknown>;
}

function path(value: string): string {
  const expanded = value.startsWith("~/")
    ? join(homedir(), value.slice(2))
    : value;
  try {
    return realpathSync(expanded);
  } catch {
    return resolve(expanded);
  }
}
function paths(value: unknown): string[] {
  const items =
    typeof value === "string"
      ? value.split(":")
      : Array.isArray(value)
        ? value
        : [];
  return [
    ...new Set(
      items
        .filter((v): v is string => typeof v === "string" && !!v.trim())
        .map((v) => path(v.trim())),
    ),
  ];
}

export function readSettings(app = "/Applications/DigUp.app"): DigUpSettings {
  const binary = join(app, "Contents/Helpers/digup");
  if (!existsSync(binary))
    throw new Error(
      "Install DigUp, or select its location in Extension Preferences.",
    );
  const exported = spawnSync(
    "/usr/bin/defaults",
    ["export", "com.abdurrahim.DigUp", "-"],
    { encoding: "utf8", timeout: 5000 },
  );
  if (exported.status !== 0)
    throw new Error(
      "Open DigUp and choose the folders you want to search first.",
    );
  const d = parsePreferences(exported.stdout);
  const support = join(homedir(), "Library/Application Support/DigUp");
  return {
    app,
    binary,
    index:
      typeof d.indexDir === "string"
        ? path(d.indexDir)
        : join(support, "index.noindex"),
    models:
      typeof d.modelsDir === "string"
        ? path(d.modelsDir)
        : join(support, "Models"),
    roots: paths(d.roots),
    excluded: paths(d.excludedFolders),
    codeRoots: paths(d.codeRoots),
    codeExcluded: paths(d.codeExcludedFolders),
    types: (Array.isArray(d.excludedTypes) ? d.excludedTypes : []).filter(
      (v): v is string => typeof v === "string",
    ),
  };
}

export function serviceArguments(settings: DigUpSettings): string[] {
  return [
    "search-service",
    ...settings.roots,
    "--index",
    settings.index,
    "--encoder-idle",
    "60",
    ...settings.excluded.flatMap((p) => ["--exclude", p]),
    ...settings.types.flatMap((p) => ["--exclude-ext", p]),
    ...settings.codeRoots.flatMap((p) => ["--code-root", p]),
    ...settings.codeExcluded.flatMap((p) => ["--code-exclude", p]),
  ];
}
