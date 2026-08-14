import fs from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

const ref = process.env.TREETOP_REST_REF ?? 'v0.0.12'
const source = process.env.TREETOP_OPENAPI_URL ?? `https://raw.githubusercontent.com/treetop-policy-engine/treetop-rest/${ref}/docs/openapi.json`
const output = new URL('../src/api/generated.ts', import.meta.url)

const ast = await openapiTS(new URL(source))
const banner = `/**\n * Generated from the treetop-rest ${ref} OpenAPI contract.\n * Do not edit by hand; run npm run api:generate.\n */\n`
await fs.writeFile(output, banner + astToString(ast))
console.log(`Generated ${output.pathname} from ${source}`)
