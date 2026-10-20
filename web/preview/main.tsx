import { createRoot } from "react-dom/client";
import App from "../src/components/App";
import { previewController } from "./controller";
import "@fontsource/noto-serif-kr/400.css";
import "@fontsource/noto-serif-kr/500.css";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/500.css";
import "@fontsource/noto-sans-kr/700.css";
import "../src/app/globals.css";
import "./preview.css";
let storage: Storage | undefined;
try {storage=window.sessionStorage;} catch {}
const controller=previewController(storage);
createRoot(document.getElementById("root")!).render(<>
  <aside className="preview-banner" aria-label="임시 체험판 안내">
    <strong>임시 체험판</strong> · 가상 정보로 둘러보세요.
    <details><summary>체험 범위와 임시 보관 안내</summary>
      <p>현재 화면과 연구 계산을 체험할 수 있어요. 입력과 결과는 이 탭에만 임시 보관하고 서버로 보내지 않아요.</p>
      <p>로그인·복구 코드·공개 공유 링크·실제 결제는 제공하지 않아요. 모의 결제에는 돈이 청구되지 않아요.</p>
    </details>
  </aside>
  <App request={controller.request} preview onResetPreview={()=>{controller.reset();try {sessionStorage.removeItem("saju-navigation-v1");}catch{} window.location.reload();}} />
</>);
