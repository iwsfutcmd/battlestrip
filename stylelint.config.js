/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-use-logical'],
  rules: {
    // Logical properties and values only (§7.3, §8): layouts must mirror in
    // RTL and transpose in vertical writing modes.
    'csstools/use-logical': ['always', { except: [] }],
    // Not covered by use-logical:
    'declaration-property-value-disallowed-list': [
      { resize: ['horizontal', 'vertical'] },
      { message: 'Use resize: inline / block.' },
    ],
    'unit-disallowed-list': [['vw', 'vh'], { message: 'Use vi/vb (or vmin/vmax) so sizes follow the writing mode.' }],
    'selector-class-pattern': ['^[a-z][a-z0-9]*(-[a-z0-9]+)*$', { message: 'Class names are kebab-case.' }],
  },
};
