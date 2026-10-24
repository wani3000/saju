import {readFileSync} from 'node:fs';
import {readPrivateJson} from './private-operations';
import {inspectLaunchDeclarations} from '../src/server/launch-completion';
try {
 const args=process.argv.slice(2);if(args.length && (args.length!==2||args[0]!=='--config'))throw new Error();
 const raw=args.length?await readPrivateJson(args[1]):JSON.parse(readFileSync(new URL('../../docs/launch-operator-settings.example.json',import.meta.url),'utf8'));
 const report=inspectLaunchDeclarations(raw);console.log(JSON.stringify(report));process.exitCode=report.missing.length?2:0;
}catch{console.log(JSON.stringify({status:'error',code:'LAUNCH_DECLARATIONS_INVALID',publicReleaseApproved:false,realChargesEnabled:false}));process.exitCode=1;}
