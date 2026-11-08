import { parseMessage, validate, visit, type Model } from 'messageformat';
import { messageSource, type Catalog, type MessageSource } from './messages.ts';

/** Parse and validate one MF2 message; throws a MessageSyntaxError/MessageDataModelError. */
export function parseSource(source: MessageSource): Model.Message {
  const msg = parseMessage(messageSource(source));
  validate(msg);
  return msg;
}

/**
 * The external variables a message expects: every `$name` it references,
 * minus names it defines itself with `.local`. (`.input` names are external.)
 */
export function messageVariables(source: MessageSource): string[] {
  const msg = parseSource(source);
  const locals = new Set<string>();
  for (const d of msg.declarations) if (d.type === 'local') locals.add(d.name);
  const seen = new Set<string>();
  visit(msg, {
    value(value) {
      if (value.type === 'variable' && !locals.has(value.name)) seen.add(value.name);
    },
  });
  for (const d of msg.declarations) if (d.type === 'input') seen.add(d.name);
  return [...seen].sort();
}

export interface ParityProblem {
  readonly key: string;
  readonly problem: 'missing' | 'extra' | 'variables' | 'syntax';
  readonly detail?: string;
}

/** Compare a catalog against the source catalog. Empty result means parity. */
export function catalogProblems(source: Catalog, target: Catalog): ParityProblem[] {
  const problems: ParityProblem[] = [];
  for (const key of Object.keys(source)) {
    const t = target[key];
    if (t === undefined) {
      problems.push({ key, problem: 'missing' });
      continue;
    }
    let want: string[];
    let got: string[];
    try {
      got = messageVariables(t);
    } catch (e) {
      problems.push({ key, problem: 'syntax', detail: String(e) });
      continue;
    }
    const s = source[key];
    if (s === undefined) continue;
    try {
      want = messageVariables(s);
    } catch {
      continue; // reported when the source catalog is checked against itself
    }
    if (want.join(',') !== got.join(',')) {
      problems.push({ key, problem: 'variables', detail: `want {${want.join(', ')}}, got {${got.join(', ')}}` });
    }
  }
  for (const key of Object.keys(target)) {
    if (!(key in source)) problems.push({ key, problem: 'extra' });
  }
  return problems;
}
