import { isAbsolute, relative, resolve } from "node:path";

export type SearchHit = {
  path: string;
  kind: string;
  segment: string;
  segment_id: number;
  score: number;
  loc?: number;
  loc_end?: number;
  focus?: number;
  excerpt?: string;
  info?: string;
};

export function allowedPath(
  path: string,
  roots: string[],
  excluded: string[],
): boolean {
  if (!isAbsolute(path)) return false;
  const inside = (root: string) => {
    const rel = relative(resolve(root), resolve(path));
    return (
      rel === "" || (rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel))
    );
  };
  return roots.some(inside) && !excluded.some(inside);
}

export function parseHits(
  reply: Record<string, unknown>,
  roots: string[],
  excluded: string[],
): SearchHit[] {
  if (!Array.isArray(reply.hits))
    throw new Error("DigUp returned an invalid search response");
  return reply.hits.filter((value): value is SearchHit => {
    if (!value || typeof value !== "object") return false;
    const h = value as SearchHit;
    return (
      typeof h.path === "string" &&
      typeof h.kind === "string" &&
      typeof h.segment === "string" &&
      Number.isSafeInteger(h.segment_id) &&
      Number.isFinite(h.score) &&
      (h.loc === undefined || Number.isFinite(h.loc)) &&
      (h.focus === undefined || Number.isFinite(h.focus)) &&
      (h.excerpt === undefined || typeof h.excerpt === "string") &&
      allowedPath(h.path, roots, excluded)
    );
  });
}

export function locationLabel(hit: SearchHit): string {
  if (hit.kind === "code" && (hit.focus !== undefined || hit.loc !== undefined))
    return `Line ${Math.max(1, Math.floor(hit.focus ?? hit.loc ?? 1))}`;
  if (hit.loc === undefined) return "";
  if (hit.kind === "pdf") return `Page ${Math.max(1, Math.floor(hit.loc))}`;
  if (["audio", "video"].includes(hit.kind)) {
    const seconds = Math.max(0, Math.floor(hit.loc));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return "";
}

export function editorTarget(hit: SearchHit, editor: string): string {
  if (hit.kind !== "code" || !["vscode", "cursor", "zed"].includes(editor))
    return hit.path;
  const path = hit.path.split("/").map(encodeURIComponent).join("/");
  return `${editor}://file${path}:${Math.max(1, Math.floor(hit.focus ?? hit.loc ?? 1))}:1`;
}
