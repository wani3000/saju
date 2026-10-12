import fs from 'node:fs';
import {koreaCivilOffsetMin} from './build/korea-timezone.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./fixtures/iana-seoul.json',import.meta.url)));
const failures=[];
for(const x of data.cases){const actual=koreaCivilOffsetMin(x.year,x.month,x.day,x.hour);if(actual!==x.offsetMinutes)failures.push({...x,actual});}
const result={total:data.cases.length,passed:data.cases.length-failures.length,failures};
fs.writeFileSync(new URL('./reports/timezone.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log({total:result.total,passed:result.passed,failed:failures.length});
