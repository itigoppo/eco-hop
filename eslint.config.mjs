import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"
import { defineConfig, globalIgnores } from "eslint/config"
import requireUseClient from "./eslint-rules/require-use-client.js"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.{js,ts,tsx}"],
    plugins: {
      custom: {
        rules: {
          "require-use-client": requireUseClient,
        },
      },
    },
    rules: {
      "custom/require-use-client": "error",
    },
  },
])

export default eslintConfig
