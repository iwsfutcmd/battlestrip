import { expect, type Page } from '@playwright/test';
import { strictTranslator } from '../src/i18n/test-helpers.ts';
import type { CatalogId } from '../src/i18n/index.ts';

export const REQUIRED: readonly CatalogId[] = ['en', 'ar', 'zh-Hant', 'en-XA', 'ar-XB'];

export const EXPECTED_DIR: Readonly<Record<CatalogId, 'ltr' | 'rtl'>> = {
  en: 'ltr',
  ar: 'rtl',
  'zh-Hant': 'ltr',
  'en-XA': 'ltr',
  'ar-XB': 'rtl',
};

/** The visible text a message renders to (isolation controls become <bdi>). */
export function visibleText(catalog: CatalogId, key: Parameters<ReturnType<typeof strictTranslator>['format']>[0]): string {
  return strictTranslator(catalog)
    .format(key)
    .replaceAll(/[\u2066-\u2069]/gu, '');
}

/** Fail the test on any console error or uncaught exception. */
export function watchForErrors(page: Page): () => void {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return () => expect(errors).toEqual([]);
}
