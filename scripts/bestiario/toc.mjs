import {loadPages,lt} from "./load.mjs";
export function parseToc(pages){
  const toc=[]; let pend="";
  const lines=pages[3].lines.slice().sort((a,b)=>(a.x<150?0:a.x<330?1:2)-(b.x<150?0:b.x<330?1:2)||a.y-b.y);
  for (const l of lines){ const t=lt(l).trim(); if(!t||/^SUM/.test(t)) continue;
    const m=t.match(/^(.*?)\.{2,}\s*(\d+)\s*$/);
    if(m){ toc.push({nome:(pend+" "+m[1]).trim(),pag:+m[2]}); pend=""; } else pend=(pend+" "+t).trim(); }
  return toc;
}
if (process.argv[1].endsWith("toc.mjs")) { const t=parseToc(loadPages()); console.log(t.length); console.log(t.map(x=>x.pag+" "+x.nome).join(" | ")); }
