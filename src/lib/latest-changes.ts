import "server-only";

// Siste endringer i appen, hentet fra de nyeste PR-ene som er merget inn på GitHub.
// Repoet er offentlig, så det trengs ingen nøkkel. Listen hentes på nytt hvert femte minutt.
const REPO = "Geobovg/SendIt";
const REFRESH_SECONDS = 300;

export type LatestChange = { title: string; mergedAt: string; url: string };

type GitHubPull = { title: string; merged_at: string | null; html_url: string };

export async function getLatestChanges(limit = 6): Promise<LatestChange[]> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: REFRESH_SECONDS },
    });
    if (!response.ok) return [];
    const pulls = (await response.json()) as GitHubPull[];
    return pulls
      .filter((pull): pull is GitHubPull & { merged_at: string } => Boolean(pull.merged_at))
      .sort((a, b) => b.merged_at.localeCompare(a.merged_at))
      .slice(0, limit)
      .map((pull) => ({ title: pull.title, mergedAt: pull.merged_at, url: pull.html_url }));
  } catch {
    // Er GitHub nede, viser forsiden bare at det ikke er noe nytt i stedet for å feile.
    return [];
  }
}
