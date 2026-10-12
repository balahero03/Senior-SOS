# SeniorSOS Folder Structure Guide

This document explains the proposed repository layout for SeniorSOS: what each folder owns, what belongs there, and how the pieces fit together. The aim is a clean monorepo for a React frontend and a single modular Node/Express backend, with Docker and Kubernetes support.

## 1. Clean architecture idea

Keep the project as a **modular monolith**:

- There is one backend application and one backend deployment.
- Backend code is split into business modules such as auth, profiles, networking, and mentorship.
- Each module owns its routes, controllers, business services, validation, and repositories.
- Database connection setup belongs in shared infrastructure folders.
- A module uses the store that fits its data: PostgreSQL for structured transactions, MongoDB for flexible content, Neo4j for relationship queries, and Redis for fast temporary/shared state.
- The frontend is organized by user-facing feature, with shared components kept separate.
- Docker and Kubernetes describe how the same applications run; they do not turn backend modules into microservices.

The basic request path is:

```text
Browser
  → Frontend feature/page
  → API client
  → Backend route
  → Controller
  → Business service
  → Repository
  → Appropriate database adapter
```

The response follows the same path back to the browser. Keep dependencies pointing inward: a route or controller can call a service, a service can call a repository, and a repository can use a database adapter. Database code should not decide UI behavior.

## 2. Recommended repository tree

```text
Senior-SOS/
├── .github/
│   └── workflows/                 # GitHub Actions workflows, when added
├── .gitignore
├── README.md                      # Project overview and quick start
├── project.md                     # Full product and architecture brief
├── FOLDER_STRUCTURE.md            # This guide
├── docker-compose.yml             # Local multi-container development stack
├── frontend/
│   ├── Dockerfile                 # Frontend image recipe
│   ├── package.json
│   ├── public/                    # Static files copied as-is
│   └── src/
│       ├── app/
│       ├── assets/
│       ├── components/
│       ├── features/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── routes/
│       ├── services/
│       ├── stores/
│       ├── styles/
│       └── types/
├── backend/
│   ├── Dockerfile                 # Backend image recipe
│   ├── package.json
│   ├── prisma/                    # Prisma schema and migrations for PostgreSQL
│   ├── src/
│   │   ├── app/
│   │   ├── config/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── modules/
│   │   ├── realtime/
│   │   └── shared/
│   └── tests/
│       ├── unit/
│       └── integration/
├── docker/
│   ├── backend/                   # Optional Docker helper files
│   └── frontend/                  # Optional Docker helper files
├── k8s/
│   ├── base/                      # Namespace/shared config or Kustomize base
│   ├── frontend/
│   ├── backend/
│   ├── postgres/
│   ├── mongodb/
│   ├── neo4j/
│   └── redis/
└── docs/
    ├── api/
    ├── architecture/
    ├── database/
    └── development/
```

The `.github/`, Dockerfiles, `docker-compose.yml`, `README.md`, and `backend/prisma/` are recommended additions. They can be created when their work starts; empty folders do not need placeholder files just to exist.

## 3. Repository-level files and folders

### `README.md`

The first page for a developer joining the repository. Keep it concise and practical:

- What SeniorSOS does.
- Main technologies.
- Required local tools.
- How to configure environment variables without publishing secrets.
- How to start frontend, backend, and dependencies.
- Links to `project.md` and `FOLDER_STRUCTURE.md`.

Do not duplicate the entire product specification here; link to `project.md`.

### `project.md`

The full product brief: user roles, features, routes, architecture, databases, roadmap, and unresolved choices. Update it when product decisions change.

### `FOLDER_STRUCTURE.md`

This repository map. Update it if the folder ownership or layout changes.

### `.gitignore`

Exclude generated or private content, including `node_modules/`, build output, local `.env` files, logs, test coverage, IDE files, and local database data. Keep safe examples such as `.env.example` in source control; never commit real passwords or keys.

### `docker-compose.yml`

Root-level local environment definition. It can coordinate frontend, backend, and whichever databases are enabled for local development. Start with only the services currently needed; the final architecture lists PostgreSQL, MongoDB, Neo4j, and Redis.

### `.github/workflows/`

Optional CI/CD configuration. Workflows can later install dependencies, lint, run tests, build Docker images, and deploy. Keep this out of the way of the first app milestone.

## 4. Frontend folders

### `frontend/public/`

Static files served/copied without importing through the application build: browser icons, static manifest, and files that need a stable public path. Most images and illustrations should instead live in `src/assets/` so they can be imported and bundled.

### `frontend/src/app/`

Application-wide setup: root app component, global providers, app initialization, and global error boundary. Examples: `App.jsx`, query/state providers if added, and top-level configuration. Do not place individual business feature logic here.

### `frontend/src/assets/`

Imported images, logos, local fonts, and other bundled visual assets. Avoid storing user-uploaded content here; uploads are runtime data and need an upload/storage service.

### `frontend/src/components/`

Reusable UI that is not owned by one business feature.

- `common/`: buttons, inputs, badges, dialogs, loading and empty states.
- `layout/`: application shell, header, sidebar, navigation, responsive layout.
- `forms/`: truly shared form fields or form primitives.

If a component only makes sense for one feature, keep it inside that feature instead of making a general component folder a dumping ground.

### `frontend/src/features/`

Feature-first frontend code. Each feature can own its components, API functions, hooks, state, and local types. Example:

```text
features/
└── mentorship/
    ├── api.js
    ├── components/
    ├── hooks/
    ├── pages/
    └── types.js
```

Existing feature folders:

- `auth/`: register, login, logout, password reset, current-user state.
- `profiles/`: own profile, public profile, editing, profile completeness.
- `discover/`: people search, filters, recommended alumni.
- `network/`: requests, connections, mutuals, path/network graph UI.
- `messages/`: conversations, message list/composer, online/typing status UI.
- `mentorship/`: mentor discovery, requests, mentor/mentee views.
- `community/`: feed, posts, comments, reactions, reporting.
- `notifications/`: notification list, unread state, preferences UI.
- `settings/`: account, security, privacy, and notification preferences.
- `admin/`: user management, verification queue, moderation, reports, audit log.

Do not make these frontend folders backend services. They are browser-side feature code.

### `frontend/src/hooks/`

Reusable React hooks used across multiple features. A hook used only by one feature belongs under that feature.

### `frontend/src/lib/`

Small third-party integrations and low-level helpers: date formatting setup, shared constants, browser utilities, and library configuration. Avoid placing business rules here.

### `frontend/src/pages/`

Optional route-level composition pages if a page combines several feature components. Keep actual feature-specific page logic under `features/<feature>/pages/` if that convention is adopted. Pick one convention consistently; do not maintain duplicate pages in both locations.

Recommended adjustment as implementation begins: either use `pages/` as the route entry point that imports feature screens, or remove it and put route pages in each feature. The current tree has both so the team can choose, but avoid duplicating files.

### `frontend/src/routes/`

Route definitions and route guards: public/authenticated/admin route trees, lazy loading, and not-found handling. Keep route wiring here; page content belongs to feature pages.

### `frontend/src/services/`

Shared communication setup, especially the Axios instance, base URL, cookie credentials, and common request/response handling. Feature-specific endpoint calls usually belong in the matching feature's `api.js` and use this shared client.

### `frontend/src/stores/`

Global Zustand stores only when state must be shared across unrelated parts of the app, such as current auth user or global realtime connection status. Feature-local state should stay in its feature. Do not copy server data into a global store without a reason; server state and UI state have different lifecycles.

### `frontend/src/styles/`

Global CSS, Tailwind entry file, design tokens, and base styles. Component-specific styling should stay close to the component where practical.

### `frontend/src/types/`

Shared frontend types if the project uses TypeScript. If using plain JavaScript, this can hold JSDoc types or be omitted. Do not create duplicate, drifting copies of backend contracts; document/API schemas should be the source for shared API shapes if they are later generated.

## 5. Backend folders

### `backend/src/app/`

Creates and configures the Express application: middleware registration, API router mounting, health endpoint, and error-handling setup. Keep process startup separate, usually in `src/server.js` at the root of `src` or a clearly named entry file.

### `backend/src/config/`

Reads and validates environment configuration: port, allowed origins, cookie settings, and database connection variables. Configuration should fail clearly when required values are missing. Never hard-code secret values here.

### `backend/src/database/`

Shared database clients, connection lifecycle, and low-level adapters. These files know how to connect to a store; business modules decide what to do with data.

- `postgres/`: Prisma client setup, connection health, transaction helpers.
- `mongodb/`: Mongoose connection and shared model configuration.
- `neo4j/`: Neo4j Driver instance, sessions/transactions, shutdown handling.
- `redis/`: Redis client and pub/sub adapter setup.

Keep one connection pool/client per process where appropriate; do not open a brand-new global database connection for every HTTP request. Close clients on graceful shutdown.

### `backend/prisma/`

Recommended folder for Prisma schema and database migrations, commonly `schema.prisma` and migration history. This is separate from runtime connection code. Prisma migrations are the versioned source of PostgreSQL schema changes.

### `backend/src/middleware/`

Cross-cutting Express middleware: authentication, role/permission checks, request IDs, rate limiting hooks, validation integration, and centralized error handling. Middleware should stay generic; business decisions belong in feature services.

### `backend/src/modules/`

The backend's business boundaries. Each module is part of the same server process and deployment. A module can have:

- `routes/`: HTTP paths and mapping to controllers.
- `controllers/`: translate HTTP request/response to service calls; avoid business rules here.
- `services/`: business rules and orchestration.
- `repositories/`: data access interfaces/queries for the module.
- `validators/`: input schemas and validation rules.

Suggested responsibility by module:

#### `modules/auth/`

Registration, login, logout, refresh/access-token lifecycle, password reset, and current-user authentication. It can call the user repository; passwords are hashed before persistence and never returned to clients.

#### `modules/users/`

Account and profile ownership: basic user details, student/alumni profile fields, profile updates, public profile response, visibility rules, and profile completion. PostgreSQL is the final architecture's user source of truth.

#### `modules/networking/`

Connection request lifecycle and graph operations: send/accept/reject requests, list connections, mutual connections, suggestions, and shortest path. Neo4j is used for graph traversal. Authoritative request/status records may also need PostgreSQL; consistency between SQL and graph is an implementation decision to document.

#### `modules/posts/`

Community posts, comments, reactions, visibility, and reports. MongoDB is the planned flexible-content store. Authorization must enforce College/Connections visibility.

#### `modules/mentorship/`

Mentorship requests, accept/reject, preferences, mentor/mentee relationships, and discovery criteria. PostgreSQL owns requests; Neo4j may represent accepted mentorship edges for graph queries if needed.

#### `modules/chat/`

Conversation authorization, message handling, and chat events. Socket.io event handlers can live under `realtime/` and call chat services. Decide where durable messages live; Redis Pub/Sub is not itself durable message history.

#### `modules/notifications/`

Notification creation, listing, read/unread state, and preferences. PostgreSQL is the proposed durable store; Socket.io can deliver new events in realtime.

#### `modules/admin/`

Admin-only user management, alumni verification, moderation, report handling, and audit events. Enforce admin authorization in backend routes/services, not only by hiding frontend controls.

### `backend/src/realtime/`

Socket.io server setup, authentication for socket connections, event registration, room membership, and Redis adapter integration. Event handlers should delegate real work to module services; do not duplicate business rules inside socket callbacks.

### `backend/src/shared/`

Small cross-module technical helpers that genuinely have multiple consumers:

- `errors/`: typed application errors and error mapping.
- `utils/`: small generic functions.
- `validation/`: shared validation primitives.

Do not use `shared/` as a place to put code whose ownership is unclear. Shared business concepts should have an explicit owner or interface.

### `backend/tests/`

- `unit/`: test isolated service/business behavior with dependencies controlled.
- `integration/`: test HTTP routes and database interactions across module boundaries.

Place tests near the owning backend package if the team later chooses a colocated convention; use one convention consistently. Tests should not contain production application code.

## 6. Database ownership rules

### PostgreSQL + Prisma

Authoritative transactional data: users, roles, structured profiles, mentorship requests, durable notifications, and audit logs. Use foreign keys and transactions for related updates.

### MongoDB + Mongoose

Flexible content: posts, comments, reactions, feed/activity documents, and optional profile extensions. Documents refer to a user by the same logical user ID, for example `authorId`.

### Neo4j + Neo4j JavaScript Driver

Relationship graph: user connection edges, mentorship edges if required, company/college relationship traversal, mutual connections, and shortest paths. Graph User nodes use the same logical user ID as PostgreSQL.

### Redis

Temporary or fast coordination data: cache, presence, rate limiting, and Socket.io cross-pod Pub/Sub. Do not treat Redis Pub/Sub as the permanent store for messages or notifications.

### Shared identity and cross-database writes

PostgreSQL owns the canonical user record. MongoDB and Neo4j store references using that same ID, not independent user identities. Cross-database updates are not one atomic transaction; when a feature writes to multiple stores, define retry/reconciliation behavior and keep the source of truth clear.

## 7. Docker and Kubernetes folders

### `docker/`

Optional service-specific support files such as development entrypoint scripts or local build helpers. Prefer each app's actual `Dockerfile` next to that app (`frontend/Dockerfile`, `backend/Dockerfile`) so its build context is easy to understand. Do not keep duplicate Dockerfiles in both places.

### `k8s/base/`

Shared namespace, common labels, shared ConfigMaps, or a Kustomize base. Keep environment-specific overlays out of the base if staging/production are added later.

### `k8s/frontend/`

Frontend Deployment and Service manifests; frontend is stateless.

### `k8s/backend/`

Backend Deployment, Service, non-secret configuration references, and health probes. Backend replicas run the same modular monolith image.

### `k8s/postgres/`, `k8s/mongodb/`, `k8s/neo4j/`

Database Service and persistent workload/storage manifests. The notes propose StatefulSets and PVCs for a local educational cluster. Never assume a container filesystem alone preserves database data.

### `k8s/redis/`

Redis workload and Service manifests when Redis is introduced. The Redis deployment mode depends on the selected demo scope.

### Kubernetes secret handling

Keep secret manifests free of real credentials in Git. Use local secret creation or an appropriate secret-management workflow. Commit only safe templates/placeholders if examples are needed.

## 8. Documentation folders

### `docs/architecture/`

System context diagrams, module boundaries, request flows, realtime design, deployment diagrams, and architecture decision records.

### `docs/api/`

Endpoint catalog, request/response examples, authentication requirements, error formats, and API schema/OpenAPI docs if adopted.

### `docs/database/`

Data ownership, relational schema notes, Mongo document shapes, Neo4j node/relationship design, indexes, and migration/sync strategy.

### `docs/development/`

Local setup, environment-variable list, common commands, troubleshooting, contribution workflow, and team conventions.

## 9. Naming and placement rules

1. Put code next to its owner. Feature-specific components belong with their feature; business rules belong in the corresponding backend service.
2. Keep HTTP concerns in routes/controllers, business rules in services, and persistence queries in repositories.
3. Keep database connection setup centralized in `database/`; do not create database connections inside controllers.
4. Do not have a route call a Prisma/Mongoose/Neo4j client directly.
5. Avoid vague folders such as `misc/`, `helpers/`, or a giant `utils/` full of unrelated behavior.
6. Avoid duplicate ownership: only one canonical location for route pages, API clients, and shared types.
7. Name folders consistently in lowercase; use one naming convention for files within each package.
8. Keep secrets, local uploads, database volumes, build output, and dependencies out of Git.
9. Add folders when there is code to put in them; empty architecture folders are only a scaffold.
10. A Kubernetes Pod boundary is a deployment choice, not a reason to split every backend module into its own service.

## 10. First implementation should be small

Even though the final tree anticipates every feature, start by filling only the folders needed for one vertical path:

```text
frontend/src/app/
frontend/src/features/auth/
frontend/src/features/profiles/
frontend/src/routes/
frontend/src/services/
backend/src/app/
backend/src/config/
backend/src/database/              # choose the active starter DB
backend/src/modules/auth/
backend/src/modules/users/
backend/src/middleware/
backend/tests/
```

The product notes' first application slice is register → login → current profile → edit profile → reload and see saved data. The notes disagree on whether that first slice uses MongoDB or whether PostgreSQL/Kubernetes should be established first; see `project.md` section “Open decisions and inconsistencies to resolve.” Keep this folder structure compatible with the final PostgreSQL + MongoDB + Neo4j architecture while the implementation sequence is decided.

## 11. Folder structure decision checklist

Before adding more code, make sure the team can answer:

- Is the frontend route page owned by `pages/` or by `features/<feature>/pages/`? Choose one.
- Are the canonical app folders `frontend/backend`? This guide recommends those names.
- Where will durable chat messages live?
- Which first vertical slice is chosen: MongoDB-first feature work or deployment-first PostgreSQL/MongoDB/Neo4j?
- How will a canonical PostgreSQL user ID be propagated to MongoDB documents and Neo4j nodes?
- Which shared API contract format will frontend and backend follow?

These choices affect implementation details, but they do not change the core separation described above.
