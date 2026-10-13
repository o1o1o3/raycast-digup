import { getPreferenceValues, open } from "@raycast/api";
export default async function Command() {
  const { applicationPath } = getPreferenceValues<Preferences>();
  await open(applicationPath?.path || "/Applications/DigUp.app");
}
