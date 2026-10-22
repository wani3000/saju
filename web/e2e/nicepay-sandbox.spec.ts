// Fully isolated app + synthetic SDK. Never contact a real payment gateway.
import {test,expect,type Page} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {samplePerson} from "../src/domain/model";
const sdk=`window.AUTHNICE={requestPay(input){const box=document.createElement('div');box.setAttribute('role','dialog');box.setAttribute('aria-label','합성 NICEPAY 창');box.textContent='activation='+navigator.userActivation.isActive;const close=document.createElement('button');close.textContent='합성 결제창 닫기';close.onclick=()=>{box.remove();input.fnError({});};box.appendChild(close);document.body.appendChild(box);}};`;
async function paidFixture(page:Page){
 await page.goto('/');await expect(page.getByRole('button',{name:'두 사람의 생일 적기',exact:true})).toBeVisible();
 const origin=new URL(page.url()).origin;
 const post=async(path:string,data:unknown={})=>{const r=await page.request.post('/api/'+path,{headers:{Origin:origin},data});expect(r.ok()).toBeTruthy();return r.json();};
 const pair={me:samplePerson(),other:samplePerson(true)};
 await post('comparisons',{pair,key:randomUUID(),intent:'request-reading'});await post('process');await post('recovery-code');
 pair.other={...pair.other,id:randomUUID(),name:'결제검증'};
 await post('comparisons',{pair,key:randomUUID(),intent:'request-reading'});
 await page.reload();await expect(page.getByRole('button',{name:'내 프로필',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'내 프로필',exact:true}).click();await page.getByRole('button',{name:'결제 내역',exact:true}).click();
 await page.getByRole('button',{name:'주문 이어가기',exact:true}).click();
}
test('slow preparation finishes before a fresh click launches SDK; close can retry without another order',async({page})=>{
 await page.route('https://pay.nicepay.co.kr/v1/js/',route=>route.fulfill({contentType:'application/javascript',body:sdk}));
 await page.route('**/api/orders/*/prepare',async route=>{await new Promise(r=>setTimeout(r,6000));await route.continue();});
 await paidFixture(page);
 await expect(page.getByRole('button',{name:'결제창 준비 중…',exact:true})).toBeDisabled();
 const launch=page.getByRole('button',{name:'NICEPAY 테스트 결제하기',exact:true});
 await expect(launch).toBeEnabled({timeout:15000});await launch.click();
 await expect(page.getByRole('dialog',{name:'합성 NICEPAY 창'})).toContainText('activation=true');
 await page.getByRole('button',{name:'합성 결제창 닫기',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'결제를 완료하지 않았어요. 주문은 이용 내역에 보관했어요.'})).toBeVisible();
 await expect(launch).toBeEnabled({timeout:15000});
 const state=await (await page.request.get('/api/state')).json();expect(state.orders).toHaveLength(1);expect(state.orders[0].state).toBe('created');
});
test('SDK load failure offers preparation retry and preserves the existing unpaid order',async({page})=>{
 let loads=0;
 await page.route('https://pay.nicepay.co.kr/v1/js/',route=>++loads===1?route.abort():route.fulfill({contentType:'application/javascript',body:sdk}));
 await paidFixture(page);
 await expect(page.getByText('결제창을 준비하지 못했네. 다시 준비해 보게.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'결제 준비 다시하기',exact:true}).click();
 const launch=page.getByRole('button',{name:'NICEPAY 테스트 결제하기',exact:true});await expect(launch).toBeEnabled();await launch.click();
 await expect(page.getByRole('dialog',{name:'합성 NICEPAY 창'})).toContainText('activation=true');
 const state=await (await page.request.get('/api/state')).json();expect(state.orders).toHaveLength(1);expect(state.orders[0].state).toBe('created');
});
