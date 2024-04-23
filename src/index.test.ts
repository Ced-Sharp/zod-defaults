import { helloWorld } from './index';

describe('Hello World', () => {
  it('should allow running hello world', () => {
    expect(helloWorld).not.toThrow();
  });
});
