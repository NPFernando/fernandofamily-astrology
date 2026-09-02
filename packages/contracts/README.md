# contracts

This package is the checked-in TypeScript view of the FastAPI OpenAPI
contract. `generate.mjs` imports the API app, writes `openapi.json`, and runs
`openapi-typescript` to produce `api-types.d.ts`.

The web client imports generated response types at endpoint boundaries, while
`apps/web/lib/api-types-check.ts` keeps the remaining ergonomic client types
assignable to the generated schemas. CI regenerates both artifacts and fails
if the working tree changes, so a Pydantic model change cannot silently drift
from the frontend.

From the repository root, regenerate after an API schema change with:

```sh
node packages/contracts/generate.mjs
```
