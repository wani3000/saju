export function calculateProfile(input:{calendar:string;year:number;month:number;day:number;leap:boolean;timeKnown:boolean;hour?:number;minute?:number}):{solar:{year:number;month:number;day:number};pillars:Record<string,string|null>;candidates?:Record<string,string[]>;policy:{version:string;productionApproved:false};[key:string]:unknown};
export const boundaryReviewSeconds: number;
