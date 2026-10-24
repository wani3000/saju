import {z} from 'zod';
const text=z.string().trim().min(2).max(300).nullable();
export const launchSettingsSchema=z.object({kind:z.literal('launch-operator-settings-v1'),
 seller:z.object({legalName:text,representative:text,businessRegistration:text,onlineSalesReport:text,address:text,supportEmail:z.string().email().nullable(),privacyOfficer:text}).strict(),
 backup:z.object({independentStorage:z.boolean(),keyCustodian:z.boolean(),scheduledExportVerified:z.boolean(),rotationVerified:z.boolean(),latestRecoveryJournal:z.boolean()}).strict(),
 alerts:z.object({recipient:z.boolean(),deliveryReceiptsAndRetries:z.boolean()}).strict(),
 withdrawal:z.object({providerCredentials:z.boolean(),durableRequestLedger:z.boolean(),externalRoundtrip:z.boolean(),financialRecordSeparation:z.boolean()}).strict(),
 review:z.object({calendarPolicy:z.boolean(),readingExpert:z.boolean(),legalPolicies:z.boolean()}).strict(),
 payment:z.object({transactionWebhook:z.boolean(),liveMerchantContract:z.boolean(),liveCredentials:z.boolean(),liveRoundtrip:z.boolean()}).strict(),
}).strict();
export function inspectLaunchDeclarations(raw:unknown){
 const c=launchSettingsSchema.parse(raw),missing:string[]=[];
 for(const [key,value]of Object.entries(c.seller))if(!value)missing.push('SELLER_'+key.replace(/[A-Z]/g,c=>'_'+c).toUpperCase());
 for(const group of ['backup','alerts','withdrawal','review','payment'] as const)for(const [key,value]of Object.entries(c[group]))if(!value)missing.push((group+'_'+key.replace(/[A-Z]/g,c=>'_'+c)).toUpperCase());
 // Declarations and a filled form are not observed evidence or permission to launch.
 return {scope:'operator-declarations-only',status:missing.length?'incomplete':'declarations-filled',missing,
  observedEvidenceVerified:false,publicReleaseApproved:false,realChargesEnabled:false,externalCalls:0};
}
