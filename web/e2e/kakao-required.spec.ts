import {test,expect} from '@playwright/test';
test('login required before entering birthdays or private history; unconfigured Kakao never pretends success',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'내 프로필',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'카카오로 시작하기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'내 프로필',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'카카오 로그인',exact:true})).toBeDisabled();
 await expect(page.getByRole('heading',{name:'사주 조회 내역',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'복구 코드 만들기'})).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'부를 이름',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'뒤로가기',exact:true}).click();
 await page.getByRole('button',{name:'나의 관계 지도 보기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'내 프로필',exact:true})).toBeVisible();
 await page.goto('/?auth=complete');
 await expect(page.getByText('로그인 상태를 확인하지 못했네. 다시 시도해 주게.')).toBeVisible();
 const state=await(await page.request.get('/api/state')).json();expect(state.authenticated).toBe(false);
 const width=await page.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);expect(width[1]).toBeLessThanOrEqual(width[0]);
});
