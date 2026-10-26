// @vitest-environment jsdom
import { isEditableTarget } from './keys';

test.each(['input', 'textarea', 'select'])('%s elements are editable targets', (tag) => {
  expect(isEditableTarget(document.createElement(tag))).toBe(true);
});

test('the page body is not an editable target', () => {
  expect(isEditableTarget(document.body)).toBe(false);
});
