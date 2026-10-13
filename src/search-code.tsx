import type { LaunchProps } from "@raycast/api";
import SearchView from "./search-view";
export default function Command(props: LaunchProps) {
  return <SearchView mode="code" launchProps={props} />;
}
