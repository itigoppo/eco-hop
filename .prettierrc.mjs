/** @type {import("prettier").Config} */
const config = {
  semi: false,
  singleQuote: false,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  trailingComma: "es5",
  arrowParens: "always",
  endOfLine: "lf",
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
}

export default config
