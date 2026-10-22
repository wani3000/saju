import {chart} from '../src/server/engine';
import {samplePerson} from '../src/domain/model';
import {readingForVersion,currentReadingVersion} from '../src/server/readings';
import {buildNarrationPacket,relations} from '../src/server/narration-contract';
import {createHash} from 'node:crypto';
import {narrationModels} from '../src/server/narration-candidate';

// Deterministic synthetic fixtures. Neither names nor raw birth records enter the API packet.
export function narrationCases(){
 const special=[
  {year:'2024',month:'2',day:'4',timeKnown:false},
  {year:'1954',month:'3',day:'21',timeKnown:false},
  {year:'1990',month:'2',day:'15',timeKnown:true,hour:'0',minute:'30'},
  {year:'1990',month:'2',day:'15',timeKnown:true,hour:'12',minute:'30'},
  {year:'2024',month:'6',day:'15',timeKnown:false},
 ];
 const seed=samplePerson();
 const people=Array.from({length:40},(_,i)=>({...seed,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,name:'합성 입력',
  ...({year:String(1970+i%40),month:String(1+i%12),day:String(8+(i*7)%20),timeKnown:i%2===0,hour:String((i*5)%24),minute:'30'}),...(special[i]??{})}));
 const charts=people.map(p=>chart(p));
 return people.flatMap((_,i)=>relations.map((relation,j)=>{
  const otherIndex=i===2||i===3?9:(i*17+(i%3===0?11:10))%40;
  const reading=readingForVersion(currentReadingVersion,{charts:{me:charts[i],other:charts[otherIndex]},relation});
  return {id:`synthetic-${String(i+1).padStart(2,'0')}-${j+1}`,packet:buildNarrationPacket(reading,relation)};
 }));
}
export function blindModels(caseId:string){
 const swap=Number.parseInt(createHash('sha256').update(caseId).digest('hex').slice(0,2),16)%2===1;
 const models=swap?[...narrationModels].reverse():[...narrationModels];
 return {A:models[0],B:models[1]};
}
export function reviewTemplate(caseId:string,packetId:string,label:'A'|'B'){
 return {caseId,packetId,label,reviewer:null,completed:false,
  ratings:{voice:null,specificity:null,consistency:null,faithfulness:null,repetition:null},
  criticalErrors:[],examples:[],notes:''};
}
