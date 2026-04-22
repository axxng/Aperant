import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// These imports will fail until scripts/mocks/github-fixtures.ts is created
import { buildIssueFixtures } from './github-fixtures.js';
import { gitHubApiIssueSchema } from '../../api/_lib/validation.js';

describe('buildIssueFixtures (MOCK-05)', () => {
  it('MOCK-05a: returns array conforming to gitHubApiIssueSchema', () => {
    const issues = buildIssueFixtures('mock-org', 'project-alpha');
    const schema = z.array(gitHubApiIssueSchema);
    expect(() => schema.parse(issues)).not.toThrow();
  });

  it('MOCK-05b: no fixture has a pull_request field', () => {
    const issues = buildIssueFixtures('mock-org', 'project-alpha');
    issues.forEach((issue) => {
      expect((issue as Record<string, unknown>).pull_request).toBeUndefined();
    });
  });

  it('MOCK-05c: fixtures include mix of open and closed issues', () => {
    const issues = buildIssueFixtures('mock-org', 'project-alpha');
    const states = new Set(issues.map((i) => i.state));
    expect(states.has('open')).toBe(true);
    expect(states.has('closed')).toBe(true);
  });
});
