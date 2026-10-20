import { createRoot } from "react-dom/client";
import App from "../src/components/App";
import { previewController } from "./controller";
import "@fontsource/noto-serif-kr/400.css";
import "@fontsource/noto-serif-kr/500.css";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/500.css";
import "@fontsource/noto-sans-kr/700.css";
import "../src/app/globals.css";
let storage: Storage | undefined;
try {storage=window.sessionStorage;} catch {}
const controller=previewController(storage);
createRoot(document.getElementById("root")!).render(<>
  <App request={controller.request} preview onResetPreview={()=>{controller.reset();try {sessionStorage.removeItem("saju-navigation-v1");}catch{} window.location.reload();}} />
</>);
