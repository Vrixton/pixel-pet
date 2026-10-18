import { describe, expect, it } from 'vitest';

import componentStyles from './styles.css?raw';

describe('component stylesheet', () => {
  it('does not style global elements', () => {
    expect(componentStyles).not.toMatch(/(^|[\s,}])(html|body|:root)\s*[{,]/);
  });
});
