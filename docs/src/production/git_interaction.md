# Using Git

By default, WEISS allows users to clone public repositories and modify files locally. If you want to
push to upstream or access private repositories, you need to configure a git service account token.
This section guides you through it and how to manage repositories from WEISS.

## Importing a repository

An user with the **developer** role can import a repository from the _Browse projects_ sidebar:

1. In **Edit mode**, open the right sidebar in the "Navigate" tab.
2. Click the **Import new repository** button and provide:
   - **Alias** - a short local name for the repository.
   - **Git URL** - the HTTPS clone URL (e.g. `https://github.com/org/opi-repo.git`).
3. WEISS clones the repository as a bare clone in the server storage volume and creates a working
   tree for the default branch.

:::{important}  
The Git URL must be accessible from the server running `weiss-api`. Private repositories require a
properly configured technical account token (see [Enabling commits](#enabling-commits) section).  
:::

### File visibility in the browser

Not all files in a cloned repository are shown in the file browser. Only the following types are
displayed:

- **OPI files** - files with the `.opi.json` extension.
- **Image files** - files with the `.svg`, `.png`, `.jpg`, or `.jpeg` extension.

All other file types (scripts, configuration files, etc.) are ignored by the interface.

Additionally, **files and folders whose name starts with `_`** (underscore) follow special
visibility rules:

- They **are visible and selectable in Edit mode**, allowing developers to organise internal or
  non-navigable assets inside a repository.
- They **are hidden and not selectable in Runtime mode**, so operators never see them.

This convention lets you keep support files (e.g. shared symbol libraries, templates) alongside your
OPIs without exposing them to end users.

---

(enabling-commits)=

## Enabling commits

To be able to push commits to the upstream repositories, you should setup a **technical account**.
The account must have a personal access token (PAT) with repository write permissions for the
repositories you want to manage from WEISS. See
[setting up a technical account](#setting-up-a-technical-account).

### Why a technical account?

A technical account is a service identity - a regular git account created specifically for an
application rather than a person - that WEISS uses to authenticate against the git hosting service
when pushing commits. Some important keys to consider:

- **Operation is NOT anonymous.** On top of the bot's identity set in `TECHNICAL_ACCOUNT_USERNAME`
  and `TECHNICAL_ACCOUNT_EMAIL`, **the LDAP identity of each user is also added to each commit**,
  leaving a clear and auditable trail in the repository history. See
  [example](https://github.com/weiss-controls/weiss-demo-opis/commits/main/).
- **Access is minimal and revocable.** The personal access token (PAT) can scoped to only the
  specific repositories and permissions it needs (write to contents). It can be revoked or rotated
  at any time without affecting any person's account.
- **It does not share credentials.** The alternative - using a developer's personal token - would
  mean that person's full account access is embedded in a shared server, and all commits would
  appear under their name even when triggered by others. A dedicated account avoids both risks.
- **It is auditable by IT.** Because the account is explicitly requested and named, IT and security
  teams can monitor its activity, apply policies, and track it separately from human accounts.

---

(setting-up-a-technical-account)=

### Setting up a technical account

You may request one from your IT or git administrator, or create a bot account yourself if
permitted. After that, logged in as the service user, generate a PAT that will be fed to WEISS app.
The token must have **repository write** permission for every repository you want to manage from
WEISS. Some useful links:

- **GitHub**:
  [Managing your Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

- **GitLab**: [Personal Access Tokens](https://docs.gitlab.com/user/profile/personal_access_tokens/)
  or [Project Access Tokens](https://docs.gitlab.com/user/project/settings/project_access_tokens/)

:::{note}  
Fine-grained tokens expire. It's recommmended to rotate the token and redeploy when applicable.  
:::

For these settings, only the following variables in your `.env` file are relevant:

```sh
TECHNICAL_ACCOUNT_TOKEN="<personal-access-token>"
TECHNICAL_ACCOUNT_USERNAME="<technical-account-username>"   # used for git identity only
TECHNICAL_ACCOUNT_EMAIL="<technical-account-email>"         # used for git identity only
```

:::{warning}  
Treat the token like a password. Store it only in the `.env` file on the server, never commit it to
a repository.  
:::
