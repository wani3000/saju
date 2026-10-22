type NicepayWindow = Window & {
  AUTHNICE?: { requestPay: (input: Record<string, unknown>) => void | false };
};
let loading: Promise<void> | undefined;
export async function prepareNicepayClient() {
  const target = window as NicepayWindow;
  if (!target.AUTHNICE) {
    loading ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://pay.nicepay.co.kr/v1/js/";
      script.async = true;
      const timeout = setTimeout(() => {
        script.remove();
        loading = undefined;
        reject(new Error("결제창 연결 시간이 지났어요. 다시 시도해 주세요."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timeout);
        if(target.AUTHNICE)resolve();
        else {script.remove();loading=undefined;reject(new Error("결제창을 불러오지 못했어요."));}
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        loading = undefined;
        reject(new Error("결제창을 불러오지 못했어요."));
      };
      document.head.appendChild(script);
    });
    await loading;
  }
  if (!target.AUTHNICE) throw new Error("결제창을 불러오지 못했어요.");
}
// Never wait for network/script loading here: the provider's form navigation
// must run during the actual click, while browser user activation is present.
export function openNicepay(checkout: Record<string, unknown>) {
  const target=window as NicepayWindow;
  if(!target.AUTHNICE || (navigator.userActivation&&!navigator.userActivation.isActive))
    return Promise.reject(new Error("결제창 준비가 끝나면 결제 버튼을 다시 눌러 주게."));
  return new Promise<void>((_resolve, reject) => {
    const started=target.AUTHNICE!.requestPay({
      ...checkout,
      fnError: () =>
        reject(
          new Error("결제를 완료하지 않았어요. 주문은 이용 내역에 보관했어요."),
        ),
    });
    if(started===false)reject(new Error("결제창을 열지 못했네. 결제 버튼을 다시 눌러 주게."));
  });
}
