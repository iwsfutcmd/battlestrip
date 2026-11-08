// Fixture for battlestrip/no-string-length. Each `expect-error` line must be reported, and only those.
declare const name: string;
declare const maybe: string | undefined;
declare const literal: 'abc' | 'de';
declare const names: string[];
declare const segments: Iterable<string>;

export const a = name.length; // expect-error
export const b = maybe?.length; // expect-error
export const c = literal.length; // expect-error
export const d = names.length;
export const e = Array.from(segments).length;
export const f = names[0]?.length; // expect-error
