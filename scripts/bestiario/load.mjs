import fs from "node:fs";
export function loadPages(){
  const pages=[]; for (const f of fs.readdirSync(".").filter(f=>/^pages_\d+\.json$/.test(f))) for (const pg of JSON.parse(fs.readFileSync(f,"utf8")).pages) pages[pg.p]=pg;
  return pages;
}
export const lt = (l)=>l.runs.map(r=>r.t).join("");
