import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "docs/**",
      "next-env.d.ts",
      "lint-summary.cjs",
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // The Three.js web components are ES5 custom elements, not modules written
  // against the project's TypeScript conventions. `var self = this` is the
  // correct idiom for a class whose callbacks are function expressions, and
  // rewriting them into arrow functions to satisfy a lint rule would be
  // editing working, verified render code for no behavioural gain.
  //
  // Narrow on purpose: this turns off ONE rule for ONE directory. Everything
  // else, including unused variables, still applies.
  {
    files: ["src/components/three/*.js"],
    rules: {
      "@typescript-eslint/no-this-alias": "off",
    },
  },
];
