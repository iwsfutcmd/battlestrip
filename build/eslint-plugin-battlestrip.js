// @ts-check
/**
 * Project-specific lint rules (§8). Plain JS so ESLint can load it directly.
 */
import ts from 'typescript';

/** @param {import('typescript').Type} type */
function isStringLike(type) {
  if (type.isUnion()) {
    const parts = type.types.filter(
      (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)),
    );
    return parts.length > 0 && parts.every(isStringLike);
  }
  return (type.flags & ts.TypeFlags.StringLike) !== 0;
}

/** @type {import('eslint').Rule.RuleModule} */
const noStringLength = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow `.length` on strings: it counts UTF-16 code units, not what a reader sees as characters.',
    },
    messages: {
      noStringLength:
        '`.length` on a string counts UTF-16 code units. For user text, count graphemes with Intl.Segmenter (see src/i18n). For ASCII-by-design data, disable this line with a reason.',
    },
    schema: [],
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    // Type information is required; without it (e.g. linting a snippet) the rule is inert.
    if (!services?.program || !services.esTreeNodeToTSNodeMap) return {};
    const checker = services.program.getTypeChecker();
    const map = services.esTreeNodeToTSNodeMap;
    return {
      /** @param {import('estree').MemberExpression} node */
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier' || node.property.name !== 'length') return;
        const tsNode = map.get(/** @type {never} */ (node.object));
        if (isStringLike(checker.getTypeAtLocation(tsNode))) {
          context.report({ node, messageId: 'noStringLength' });
        }
      },
    };
  },
};

/** Attributes whose values a person reads or hears. */
const USER_FACING_ATTRIBUTES = new Set([
  'alt',
  'title',
  'placeholder',
  'label',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'aria-braillelabel',
  'aria-brailleroledescription',
]);

/** Text a reader would need translated: anything with a letter in any script. */
const HAS_LETTER = /\p{L}/u;

/**
 * String literals that end up as rendered text in this expression position:
 * the literal itself, either branch of `a ? 'x' : 'y'`, the right side of
 * `a && 'x'` / `a ?? 'x'`, and the static parts of template literals.
 * @param {import('estree').Node} node
 * @returns {import('estree').Node[]}
 */
function renderedLiterals(node) {
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' && HAS_LETTER.test(node.value) ? [node] : [];
    case 'TemplateLiteral':
      return node.quasis.some((q) => HAS_LETTER.test(q.value.cooked ?? q.value.raw)) ? [node] : [];
    case 'ConditionalExpression':
      return [...renderedLiterals(node.consequent), ...renderedLiterals(node.alternate)];
    case 'LogicalExpression':
      return [...renderedLiterals(node.left), ...renderedLiterals(node.right)];
    default:
      return [];
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const noLiteralUiString = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow user-facing literal text in JSX; use a catalog message (<Msg id=…>).' },
    messages: {
      literal: 'User-facing text must come from a message catalog (<Msg id="…" /> or translator.format). Found: {{text}}',
    },
    schema: [],
  },
  create(context) {
    /** @param {import('estree').Node} node @param {string} text */
    const report = (node, text) =>
      context.report({ node, messageId: 'literal', data: { text: JSON.stringify(text.trim().slice(0, 40)) } });
    return {
      /** @param {any} node */
      JSXText(node) {
        if (HAS_LETTER.test(node.value)) report(node, node.value);
      },
      /** @param {any} node */
      JSXExpressionContainer(node) {
        const parent = node.parent;
        const isChild = parent?.type === 'JSXElement' || parent?.type === 'JSXFragment';
        const attr =
          parent?.type === 'JSXAttribute' && parent.name.type === 'JSXIdentifier' ? parent.name.name : undefined;
        if (!isChild && !(attr && USER_FACING_ATTRIBUTES.has(attr))) return;
        for (const lit of renderedLiterals(node.expression)) report(lit, context.sourceCode.getText(lit));
      },
      /** @param {any} node */
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || !USER_FACING_ATTRIBUTES.has(node.name.name)) return;
        const v = node.value;
        if (v?.type === 'Literal' && typeof v.value === 'string' && HAS_LETTER.test(v.value)) report(v, v.value);
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'eslint-plugin-battlestrip' },
  rules: { 'no-string-length': noStringLength, 'no-literal-ui-string': noLiteralUiString },
};

export default plugin;
