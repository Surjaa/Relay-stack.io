// Verifies all campaign levels: each is solvable, its stored par equals the solver's exact minimum,
// and the solution really reaches the exit. Prints only problems and a summary.
// Run from the project folder in Command Prompt:  npm test
import { parseLevel, solve, simulate } from '../logic.js';
import { LEVELS, WORLDS } from '../levels.js';

let failed = 0;
for (const def of LEVELS) {
  const L = parseLevel(def);
  const sol = solve(L);
  if (!sol) { failed++; console.log(`FAIL  ${def.id} ${def.name}: unsolvable`); continue; }
  if (!simulate(L, sol.dirs).ok) { failed++; console.log(`FAIL  ${def.id}: solution does not reach exit`); continue; }
  if (sol.cost !== def.par) { failed++; console.log(`FAIL  ${def.id}: stored par ${def.par} but solver says ${sol.cost}`); }
}
if (failed) { console.log(`\n${failed} level(s) failed`); process.exitCode = 1; }
else console.log(`All ${LEVELS.length} levels solvable, par verified (${WORLDS.length} worlds).`);
