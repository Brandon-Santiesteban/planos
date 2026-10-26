import { createEmptyProject } from '../model/defaults';
import { addWall } from '../model/ops';
import { useEditor } from '../store/editorStore';
import { useGrid, visibleMinorStep } from './gridSettings';
import { snapForTool, type ToolContext } from './tools';

const view = { centre: { x: 0, y: 0 }, pxPerMetre: 100 };
const ctx = (): ToolContext => ({ state: useEditor.getState(), view, altKey: false, shiftKey: false });

beforeEach(() => {
  useEditor.getState().loadProject(createEmptyProject());
  useGrid.setState({ visible: true, step: 0.5 });
});

test('points snap to the chosen grid size', () => {
  useGrid.getState().setStep(1);
  expect(snapForTool({ x: 0.4, y: 1.3 }, ctx()).point).toEqual({ x: 0, y: 1 });
  useGrid.getState().setStep(0.1);
  expect(snapForTool({ x: 0.44, y: 1.31 }, ctx()).point).toEqual({ x: 0.4, y: 1.3 });
});

test('with the grid hidden points stay free…', () => {
  useGrid.getState().setVisible(false);
  expect(snapForTool({ x: 0.44, y: 1.31 }, ctx()).point).toEqual({ x: 0.44, y: 1.31 });
});

test('…but still stick to wall corners', () => {
  useEditor.getState().apply((d) => void addWall(d, d.floors[0].id, { x: 0, y: 0 }, { x: 4, y: 0 }));
  useGrid.getState().setVisible(false);
  expect(snapForTool({ x: 4.05, y: 0.02 }, ctx()).point).toEqual({ x: 4, y: 0 });
});

test('minor lines are only drawn when they are at least 6 px apart', () => {
  expect(visibleMinorStep(0.1, 100)).toBe(0.1);
  expect(visibleMinorStep(0.1, 40)).toBeNull();
  expect(visibleMinorStep(1, 100)).toBeNull(); // 1 m lines are the major grid
});
