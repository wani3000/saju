"use client";
import {useEffect,useRef,useState} from "react";
import {openNicepay,prepareNicepayClient} from "./nicepay-client";
type Checkout=Record<string,unknown>;
type Props={orderId:string;busy:boolean;request:(path:string,body:unknown)=>Promise<Checkout>;run:(fn:()=>Promise<void>)=>Promise<void>};
export default function NicepayCheckoutButton({orderId,busy,request,run}:Props){
 const [ready,setReady]=useState<{input:Checkout;at:number}|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 const mounted=useRef(false);
 useEffect(()=>{
  let active=true;mounted.current=true;setReady(null);setError("");
  void Promise.all([request(`orders/${orderId}/prepare`,{}),prepareNicepayClient()]).then(([input])=>{
   if(active)setReady({input,at:Date.now()});
  }).catch(()=>{if(active)setError("결제창을 준비하지 못했네. 다시 준비해 보게.");});
  return ()=>{active=false;mounted.current=false;};
 },[orderId,request,attempt]);
 function launch(){
  if(!ready||busy)return;
  // A fresh preparation is allowed before a new click, never during bank auth.
  if(Date.now()-ready.at>5*60_000){setAttempt(n=>n+1);return;}
  const input=ready.input;setReady(null);
  void run(()=>openNicepay(input)).finally(()=>{if(mounted.current)setAttempt(n=>n+1);});
 }
 return <>{error?<><p role="alert">{error}</p><button className="secondary" disabled={busy} onClick={()=>setAttempt(n=>n+1)}>결제 준비 다시하기</button></>:<button className="primary" disabled={busy||!ready} onClick={launch}>{ready?"NICEPAY 테스트 결제하기":"결제창 준비 중…"}</button>}</>;
}
