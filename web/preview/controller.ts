import { draftSchema, AppError, type Pair, type SavedResult } from "../src/domain/model";
import { validatePair } from "../src/server/engine";
import { currentReadingVersion, readingForVersion } from "../src/server/readings";
import type { State } from "../src/components/App";
const storageKey = "chunbae-static-preview-v1";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Comparison = { id: string; pair: Pair; charts: Record<string, unknown>; state: string; key: string; order_id: string | null; created_at?:string };
type PreviewData = { version: 1; draft: Pair | null; revision: number; results: SavedResult[];
  comparisons: Comparison[]; orders: State["orders"]; free: boolean };
const empty = (): PreviewData => ({version:1,draft:null,revision:0,results:[],comparisons:[],orders:[],free:true});
export function previewController(storage?: Storage) {
  let data = empty();
  let retired = false;
  try {
    const raw = JSON.parse(storage?.getItem(storageKey) ?? "null");
    if (raw?.version === 1 && Array.isArray(raw.results) && Array.isArray(raw.comparisons) && Array.isArray(raw.orders) &&
      typeof raw.free === "boolean" && Number.isSafeInteger(raw.revision) && (!raw.draft || draftSchema.safeParse(raw.draft).success)) data = raw;
  } catch { /* Private browsing or malformed temporary storage falls back to memory. */ }
  const persist = () => { try { storage?.setItem(storageKey, JSON.stringify(data)); } catch { /* In-memory preview still works. */ } };
  const state = (): State => ({kind:"preview",authEnabled:false,authLinked:false,authRequired:false,authenticated:false,profile:null,
    readingHistory:data.comparisons.map(c=>({id:c.id,other_name:c.pair.other.name,relation:c.pair.other.relation,created_at:c.created_at??data.results.find(r=>r.id===c.id)?.createdAt??data.orders.find(o=>o.id===c.order_id)?.created_at??"",state:c.state,can_open:data.results.some(r=>r.id===c.id),entitlement_state:c.state==="cancelled"?"revoked":null})),draft:data.draft,revision:data.revision,
    free:data.free ? "available" : "consumed",results:data.results,
    pending:data.comparisons.filter(c=>!data.results.some(r=>r.id===c.id)&&c.state!=="cancelled").map(c=>{
      const order=data.orders.find(o=>o.id===c.order_id);
      return {id:c.id,state:c.state,order_id:c.order_id ?? "",order_state:order?.state ?? "",amount:order?.amount ?? 0,provider:"mock"};
    }),shares:[],orders:data.orders,provider:"mock",tossClientKey:null});
  const request = async (path:string, body?:any, method=body === undefined ? "GET" : "POST"):Promise<any> => {
    if (retired) throw new AppError("PREVIEW_RESET",409,"체험 기록을 초기화했어요. 화면을 다시 열어 주세요.");
    if (path === "session" && method === "POST") return {preview:true};
    if (path === "state" && method === "GET") return structuredClone(state());
    if (path === "draft" && method === "POST") {
      const parsed=draftSchema.safeParse(body?.pair);
      if (!parsed.success) throw new AppError("INVALID_DRAFT",422,"입력 내용을 확인해 주세요.");
      if (body.revision !== data.revision) throw new AppError("REVISION_CONFLICT",409,"체험 기록을 다시 불러와 주세요.");
      data.draft=parsed.data;data.revision++;persist();return {revision:data.revision};
    }
    if (path === "comparisons" && method === "POST") {
      if (body?.intent !== "request-reading" && body?.consent !== true) throw new AppError("READING_REQUEST_REQUIRED",422,"이야기 보기 버튼을 눌러 다시 요청해 주세요.");
      const existing=data.comparisons.find(c=>c.key===body.key);
      if (existing) return {id:existing.id};
      const checked=validatePair(body.pair);
      const id=crypto.randomUUID(), order_id=data.free ? null : crypto.randomUUID();
      data.comparisons.push({id,pair:checked.pair,charts:checked.charts,state:order_id?"awaiting-payment":"queued",key:body.key,order_id,created_at:new Date().toISOString()});
      if (order_id) data.orders.push({id:order_id,comparison_id:id,amount:2900,state:"created",provider:"mock",created_at:new Date().toISOString(),other_name:checked.pair.other.name});
      else data.free=false;
      persist();return {id};
    }
    if (path === "process" && method === "POST") {
      for (const c of data.comparisons.filter(c=>c.state==="queued")) {
        const reading=readingForVersion(currentReadingVersion,{charts:c.charts,relation:c.pair.other.relation});
        data.results.push({id:c.id,me:structuredClone(c.pair.me),other:structuredClone(c.pair.other),charts:c.charts,reading,createdAt:new Date().toISOString()});
        c.state="done";
      }
      persist();return {preview:true};
    }
    const action=/^orders\/([^/]+)\/(confirm|cancel|refund|reconcile)$/.exec(path);
    if (action && method === "POST") {
      const order=data.orders.find(o=>o.id===action[1]);
      const comparison=data.comparisons.find(c=>c.id===order?.comparison_id);
      if (!order||!comparison) throw new AppError("NOT_FOUND",404);
      if (action[2]==="confirm") {
        if (body?.paymentKey!==`mock_${order.id}`||body?.amount!==order.amount) throw new AppError("INVALID_PAYMENT",422);
        if (order.state==="created") {order.state="paid";comparison.state="queued";}
        else if(order.state!=="paid") throw new AppError("ORDER_CLOSED",409);
      } else if(action[2]==="cancel") {
        if(order.state!=="created") throw new AppError("ORDER_CLOSED",409);
        order.state="cancelled";comparison.state="cancelled";
      } else if(action[2]==="refund") {
        order.state="refunded";comparison.state="cancelled";data.results=data.results.filter(r=>r.id!==comparison.id);
      }
      persist();return {preview:true};
    }
    // Every unsupported path, including real authentication, public links, and recovery, is closed.
    throw new AppError("PREVIEW_ONLY",503,"임시 체험판에서는 이 연결을 제공하지 않아요. 입력·결과와 공유 미리보기만 확인할 수 있어요.");
  };
  return { request, reset() {retired=true;data=empty();try {storage?.removeItem(storageKey);}catch{} } };
}
