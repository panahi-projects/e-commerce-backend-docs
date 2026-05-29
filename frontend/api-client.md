# Generating an API Client

Instead of writing fetch calls manually, you can auto-generate a fully typed API client from the OpenAPI spec.

## Get the OpenAPI spec

The JSON spec is available at:

```
https://<backend-domain>/api/v1/docs-json
```

Download it:

```bash
curl -o openapi.json https://panahi-projects.liara.run/api/v1/docs-json
```

## Option 1 — openapi-typescript (types only)

Generates TypeScript types from the spec. You write the fetch calls, but every request/response is fully typed.

```bash
npx openapi-typescript openapi.json -o src/api/schema.ts
```

Usage:

```typescript
import type { paths } from './api/schema';

type LoginBody = paths['/api/v1/auth/login']['post']['requestBody']['content']['application/json'];
type LoginResponse =
  paths['/api/v1/auth/login']['post']['responses']['201']['content']['application/json'];
```

## Option 2 — openapi-fetch (types + client)

Pairs with `openapi-typescript` for a typed fetch client with zero runtime overhead.

```bash
npm install openapi-fetch
npx openapi-typescript openapi.json -o src/api/schema.ts
```

Usage:

```typescript
import createClient from 'openapi-fetch';
import type { paths } from './api/schema';

const api = createClient<paths>({
  baseUrl: 'https://panahi-projects.liara.run',
  credentials: 'include',
  headers: { 'X-Tenant-ID': 'default' },
});

// Fully typed — autocomplete on paths, params, body, response
const { data, error } = await api.GET('/api/v1/products', {
  params: { query: { page: 1, limit: 20 } },
});
```

## Option 3 — Swagger Codegen / OpenAPI Generator

Generates a full API client class with methods for every endpoint.

```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-axios \
  -o src/api/generated
```

This creates an Axios-based client. Available generators: `typescript-axios`, `typescript-fetch`, `typescript-angular`.

## Keeping it updated

Re-run the generator whenever the backend API changes. You can add a script to `package.json`:

```json
{
  "scripts": {
    "api:types": "curl -o openapi.json https://panahi-projects.liara.run/api/v1/docs-json && npx openapi-typescript openapi.json -o src/api/schema.ts"
  }
}
```

## Import into Postman

1. Open Postman
2. Click **Import**
3. Paste the URL: `https://panahi-projects.liara.run/api/v1/docs-json`
4. Postman creates a collection with all endpoints, grouped by tag
