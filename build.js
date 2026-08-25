// This script runs on Vercel during build.
// Reads BACKEND_URL env var and writes config.js
const fs = require("fs");
const url = process.env.BACKEND_URL;
if (!url) {
  console.error("ERROR: BACKEND_URL env var not set. Add it in Vercel Project Settings -> Environment Variables");
  process.exit(1);
}
fs.writeFileSync("config.js", 'const BACKEND_URL = "' + url + '";\n');
console.log("config.js generated with:", url);