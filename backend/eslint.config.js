const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_|^req$|^res$|^next$" }],
      "no-console": "off",
      "no-undef": "error",
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": "warn",
    },
  },
  {
    ignores: ["node_modules/", "uploads/"],
  },
];