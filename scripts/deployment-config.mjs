const normalizeSite = (value) => value.trim().replace(/\/+$/, "");

const normalizeBase = (value) => {
  const path = value.trim().replace(/^\/+|\/+$/g, "");
  return path ? `/${path}` : "/";
};

export function deploymentTarget(env = process.env) {
  const repository = (env.GITHUB_REPOSITORY ?? "").trim();
  const [owner, repo, extra] = repository.split("/");
  const hasRepository = Boolean(owner && repo && !extra);
  const configuredSite = (env.SITE_URL ?? "").trim();
  const configuredBase = (env.BASE_PATH ?? "").trim();

  if (configuredSite) {
    return {
      site: normalizeSite(configuredSite),
      base: configuredBase ? normalizeBase(configuredBase) : "/"
    };
  }

  if (hasRepository) {
    const account = owner.toLowerCase();
    const isAccountSite = repo.toLowerCase() === `${account}.github.io`;
    return {
      site: `https://${account}.github.io`,
      base: isAccountSite ? "/" : normalizeBase(repo)
    };
  }

  return {
    site: "http://localhost:4321",
    base: configuredBase ? normalizeBase(configuredBase) : "/"
  };
}
