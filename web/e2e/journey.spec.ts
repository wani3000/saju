import { test, expect, type Page } from "@playwright/test";
const consent = "연구 체험과 두 사람의 정보 저장에 동의해요.";
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button",{name:"첫 상대 무료로 보기",exact:true}).click();
}
async function review(page: Page) {
  await start(page);
  await page.getByRole("button",{name:"가상 정보 채우기"}).click();
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await expect(page.getByRole("heading",{name:"상대방의 정보",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"가상 정보 채우기"}).click();
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await expect(page.getByRole("heading",{name:"두 사람을 확인해요"})).toBeVisible();
}
async function result(page: Page) {
  await review(page);
  await page.getByRole("checkbox",{name:consent}).check();
  await page.getByRole("button",{name:"무료 기호 비교 보기"}).click();
  await expect(page.getByRole("heading",{name:"두 사람의 사주 기호",exact:true})).toBeVisible();
}
async function noOverflow(page: Page) {
  const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  expect(size.document).toBeLessThanOrEqual(size.viewport);
}
test("input errors, direct edit return and reload preserve the server draft without restoring consent",async({page},testInfo)=>{
  await start(page);
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await expect(page.getByLabel("부를 이름",{exact:true})).toBeFocused();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button",{name:"가상 정보 채우기"}).click();
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await expect(page.getByRole("heading",{name:"상대방의 정보",exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading",{name:"상대방의 정보",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"가상 정보 채우기"}).click();
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await page.getByRole("checkbox",{name:consent}).check();
  await page.getByRole("button",{name:"수정",exact:true}).first().click();
  await page.getByLabel("부를 이름",{exact:true}).fill("가상나");
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await expect(page.getByRole("heading",{name:"두 사람을 확인해요"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"가상나",exact:true})).toBeVisible();
  await expect(page.getByRole("checkbox",{name:consent})).not.toBeChecked();
  await page.getByRole("checkbox",{name:consent}).check();
  await page.reload();
  await expect(page.getByRole("heading",{name:"두 사람을 확인해요"})).toBeVisible();
  await expect(page.getByRole("checkbox",{name:consent})).not.toBeChecked();
  const state=await (await page.request.get("/api/state")).json();
  expect(state.results).toHaveLength(0);expect(state.free).toBe("available");
  expect(state.draft.me.name).toBe("가상나");
  await noOverflow(page);
  await page.screenshot({path:testInfo.outputPath("review-restored.png"),fullPage:true,timeout:5000});
});
test("free snapshot reload, private evidence, share preview and revocation stay consistent",async({page,context,browser},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await result(page);
  const before=await (await page.request.get("/api/state")).json();
  await page.reload();
  await expect(page.getByRole("heading",{name:"두 사람의 사주 기호",exact:true})).toBeVisible();
  await page.getByText("비교 근거와 확인 범위",{exact:true}).click();
  await expect(page.getByText(/묘·유의 지지 육충/)).toBeVisible();
  await expect(page.getByText(/을·경의 천간 합/)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({path:testInfo.outputPath("result.png"),fullPage:true,timeout:5000});
  await page.getByRole("button",{name:"생일 없이 이야기 공유"}).click();
  await expect(page.getByRole("heading",{name:"함께 이야기해 봐요",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"이 내용으로 30일 공유 링크 만들기"}).click();
  const url=await page.getByLabel("공유 링크",{exact:true}).inputValue();
  const publicPage=await context.newPage();await publicPage.goto(url);
  await expect(publicPage.getByRole("heading",{name:"함께 이야기해 봐요",exact:true})).toBeVisible();
  expect(await publicPage.locator("main").innerText()).not.toMatch(/1990|1992|나래|하루|묘·유|을·경/);
  await noOverflow(publicPage);
  await publicPage.screenshot({path:testInfo.outputPath("share.png"),fullPage:true,timeout:5000});
  // A tab checkpoint can never substitute for server ownership, even when copied.
  const raw=await page.evaluate(()=>sessionStorage.getItem("saju-navigation-v1"));
  const stranger=await browser.newContext();const other=await stranger.newPage();
  await other.addInitScript(raw=>sessionStorage.setItem("saju-navigation-v1",raw!),raw);
  await other.goto(new URL("/",url).href);
  await expect(other.getByRole("button",{name:"첫 상대 무료로 보기",exact:true})).toBeVisible();
  expect(await other.locator("main").innerText()).not.toContain("나래");
  await stranger.close();
  await page.reload();
  await expect(page.getByRole("heading",{name:"우리 이야기 나누기",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"이 링크 철회하기"}).click();
  await publicPage.reload();await expect(publicPage.getByRole("heading",{name:/지금은 볼 수 없는/})).toBeVisible();
  await page.getByRole("button",{name:"← 뒤로",exact:true}).click();
  await expect(page.getByRole("heading",{name:"두 사람의 사주 기호",exact:true})).toBeVisible();
  const after=await (await page.request.get("/api/state")).json();
  expect(after.results).toEqual(before.results);expect(after.orders).toHaveLength(0);
  expect(errors).toEqual([]);
});
test("failed draft save retains typed inputs and retry advances only after persistence",async({page})=>{
  await start(page);
  await page.route("**/api/draft",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"저장 연결을 확인해 주세요."})}));
  await page.getByRole("button",{name:"가상 정보 채우기"}).click();
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("저장 연결을 확인해 주세요.");
  await expect(page.getByLabel("부를 이름",{exact:true})).toHaveValue("나래");
  await expect(page.getByRole("heading",{name:"나의 정보",exact:true})).toBeVisible();
  await page.unroute("**/api/draft");
  await page.getByRole("button",{name:"저장하고 다음"}).click();
  await expect(page.getByRole("heading",{name:"상대방의 정보",exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading",{name:"상대방의 정보",exact:true})).toBeVisible();
});
test("logout clears screen hints, recovery keeps the result and erasure disables an active public link",async({page,context})=>{
  await result(page);
  await page.getByRole("button",{name:"생일 없이 이야기 공유"}).click();
  await page.getByRole("button",{name:"이 내용으로 30일 공유 링크 만들기"}).click();
  const url=await page.getByLabel("공유 링크",{exact:true}).inputValue();
  await page.getByRole("button",{name:"보관함",exact:true}).click();
  await page.getByRole("button",{name:"복구 코드 만들기",exact:true}).click();
  const code=await page.getByLabel("지금 한 번만 표시되는 복구 코드",{exact:true}).inputValue();
  expect(await page.evaluate(()=>sessionStorage.getItem("saju-navigation-v1"))).not.toContain(code);
  await page.getByRole("button",{name:"보관함에서 나가기",exact:true}).click();
  await expect(page.getByRole("button",{name:"첫 상대 무료로 보기",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"보관함",exact:true}).click();
  await page.getByLabel("복구 코드",{exact:true}).fill(code);
  await page.getByRole("button",{name:"코드로 보관함 전환",exact:true}).click();
  await expect(page.getByRole("heading",{name:"가까운 사람들",exact:true})).toBeVisible();
  const state=await (await page.request.get("/api/state")).json();
  expect(state.results).toHaveLength(1);expect(state.orders).toHaveLength(0);
  await page.getByRole("button",{name:"보관함",exact:true}).click();
  await page.getByRole("checkbox",{name:"내용을 확인했고 내 정보를 지울게요"}).check();
  await page.getByRole("button",{name:"내 정보 삭제",exact:true}).click();
  await expect(page.getByRole("button",{name:"첫 상대 무료로 보기",exact:true})).toBeVisible();
  const publicPage=await context.newPage();await publicPage.goto(url);
  await expect(publicPage.getByRole("heading",{name:/지금은 볼 수 없는/})).toBeVisible();
});
