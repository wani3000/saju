import type {Reading} from './model';
import {coherentReadingVersion} from './coherent-reading';

export const reviewedDialogueVersion='chunbae-reviewed-dialogue-v9';

/** Editorial correction only. Preserve v8 facts, personal traits and stored snapshots. */
export function addReviewedDialogue(previous:Reading):Reading {
  if(previous.ruleVersion!==coherentReadingVersion||previous.wholeChart?.version!==coherentReadingVersion)
    throw new Error('INVALID_DIALOGUE_REVIEW_CONTEXT');
  const next=structuredClone(previous);
  const conversation=next.wholeChart!.pair.sections.find(s=>s.id==='conversation');
  if(!conversation)throw new Error('MISSING_DIALOGUE_SECTION');
  const lines=conversation.text.split('\n');
  const tail=lines.slice(-4);
  // Only collapse the identical two-turn example; never merge different needs or replies.
  if(tail.length===4&&tail.every(line=>/^(자네|상대): “.+”$/.test(line))){
    const speech=tail.map(line=>line.replace(/^(자네|상대): /,''));
    if(speech[0]===speech[2]&&speech[1]===speech[3])conversation.text=lines.slice(0,-2).join('\n');
  }
  next.ruleVersion=reviewedDialogueVersion;
  next.wholeChart!.version=reviewedDialogueVersion;
  return next;
}
