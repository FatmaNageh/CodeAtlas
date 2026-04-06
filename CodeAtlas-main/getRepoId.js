const path = require('path');
const crypto = require('crypto');
function sha1(input) { return crypto.createHash("sha1").update(input).digest("hex"); }
function normalizePath(p) { return p.replace(/\\/g, "/"); }
function repoIdFromPath(repoRoot) { return sha1(normalizePath(path.resolve(repoRoot))).slice(0, 12); }
console.log(repoIdFromPath(process.argv[2]));
