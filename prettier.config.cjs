module.exports = {
    semi: false, // Standard JS Style does not use semicolons
    trailingComma: 'es5', // Trailing commas where valid in ES5 (objects, arrays, etc.)
    singleQuote: true, // Use single quotes instead of double quotes
    printWidth: 80, // Line length of 80 characters
    tabWidth: 2, // Set a tab width of 2 spaces
    useTabs: false, // Use spaces instead of tabs
    bracketSpacing: true, // Spaces between brackets in object literals
    arrowParens: 'avoid', // Only add parens when necessary
    endOfLine: 'lf', // Line feed only (\n), common on Linux and macOS as well as inside git repos
    plugins: ["prettier-plugin-svelte"],
};