import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { WithdrawalProviderError, type WithdrawalProvider } from './withdrawal';

export function withdrawalProvider(settings: Record<string, string | undefined>, transport: typeof fetch = fetch): WithdrawalProvider | undefined {
  const url = settings.SUPABASE_URL;
  const secret = settings.SUPABASE_SECRET_KEY || settings.SUPABASE_SERVICE_ROLE_KEY;
  const admin = settings.KAKAO_ADMIN_KEY;
  // Dedicated research staging only. An operator must explicitly enable the
  // private worker; the web server never needs these administrator credentials.
  if (settings.WITHDRAWAL_WORKER_ENABLED !== 'true' || settings.SAJU_MODE !== 'research' ||
      settings.ALLOW_REMOTE_TEST !== 'true' || !url || !/^https:\/\/[a-z]{20}\.supabase\.co$/.test(url) ||
      settings.KAKAO_APP_ID !== '1618169' || !secret || !admin) return undefined;
  const timedFetch: typeof fetch = (input, init) => transport(input, {
    ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(15000), ...(init?.signal ? [init.signal] : [])]),
  });
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: timedFetch } });
  const sdkFailure = (error: { status?: number }) => new WithdrawalProviderError(
    [400,401,403,422].includes(error.status ?? 0) ? 'PROVIDER_REJECTED' : 'RESPONSE_UNCERTAIN');
  return {
    async lookupKakaoId(subject) {
      if (!z.uuid().safeParse(subject).success) throw new WithdrawalProviderError('IDENTITY_UNAVAILABLE');
      const { data, error } = await supabase.auth.admin.getUserById(subject);
      if (error) throw sdkFailure(error);
      const identities = data.user?.identities?.filter(i => i.provider === 'kakao');
      if (data.user?.id !== subject || identities?.length !== 1) throw new WithdrawalProviderError('IDENTITY_UNAVAILABLE');
      const id = identities[0].identity_data?.sub;
      // Provider identities returned by the verified Supabase admin lookup only.
      if (typeof id !== 'string' || !/^[0-9]{1,30}$/.test(id)) throw new WithdrawalProviderError('IDENTITY_UNAVAILABLE');
      return id;
    },
    async unlinkKakao(id) {
      if (!/^[0-9]{1,30}$/.test(id)) throw new WithdrawalProviderError('IDENTITY_UNAVAILABLE');
      const response = await timedFetch('https://kapi.kakao.com/v1/user/unlink', {
        method: 'POST', headers: { Authorization: `KakaoAK ${admin}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({ target_id_type: 'user_id', target_id: id }),
      });
      if (!response.ok) throw sdkFailure({ status: response.status });
      const payload = await response.json();
      const returned = typeof payload.id === 'string' ? payload.id : Number.isSafeInteger(payload.id) ? String(payload.id) : null;
      if (returned !== id) throw new WithdrawalProviderError('RESPONSE_UNCERTAIN');
    },
    async deleteSupabase(subject) {
      if (!z.uuid().safeParse(subject).success) throw new WithdrawalProviderError('IDENTITY_UNAVAILABLE');
      const { error } = await supabase.auth.admin.deleteUser(subject, false);
      if (error) throw sdkFailure(error);
    },
  };
}
