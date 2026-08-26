# Builds this repository's Vite/React SPA and serves the static dist/ output from a minimal nginx
# image - the shape `ago-console`'s own Dockerfile settled on, reused rather than reinvented.
#
# **`adr/0051`'s rule applies here from the first commit: a frontend image takes no environment input
# from its build command.** Every value that varies by environment belongs in a committed
# `.env.production`, so the commit determines the artifact. Adding a `VITE_*` build ARG would let two
# different bundles claim one commit-SHA tag, which is exactly the property that decision exists to
# protect.
#
# `.env.production` is deliberately **not** in this repository yet, and this is the honest reason:
# AGO Calendar has no deployment. Committing one would mean inventing an API origin and a Keycloak
# issuer for a cluster that does not run this product - `CLAUDE.md`: do not invent endpoints. Until
# there is a real deployment, `npm run build` here produces a bundle from whatever `.env.local` the
# developer has, and `docker build` produces one that fails at runtime with `config.ts`'s own
# "Missing required environment variable" - loudly, which is the correct behaviour for a bundle
# nobody has told where to point.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine-slim
# The commit this image is built from. Defaults to "unknown" rather than failing: a local
# `docker build` to look at the output is legitimate, and it should say so out loud rather than
# claim a commit.
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.source="https://github.com/golyakoff/ago-calendar-console" \
      org.opencontainers.image.description="AGO Calendar operator console" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${GIT_COMMIT}"
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# The commit as a file the running container serves, so a `curl .../version.json` can answer
# "which build is this?" without parsing a minified bundle. `ago-console` learned that the hard way
# on 2026-08-25, when a week-stale bundle was undetectable from outside the cluster. No build
# timestamp: two builds of one commit should be the same artifact.
RUN printf '{"app":"ago-calendar-console","commit":"%s"}\n' "${GIT_COMMIT}" \
      > /usr/share/nginx/html/version.json
EXPOSE 80
