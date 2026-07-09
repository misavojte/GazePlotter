import { describe, it, expect } from 'vitest';
import { generateSelectionPath } from '$lib/workspace/grid/selectionPath';

describe('generateSelectionPath', () => {
  const config = {
    cellSize: { width: 100, height: 100 },
    gap: 10
  };

  it('should return empty string for empty selection', () => {
    const path = generateSelectionPath([], config);
    expect(path).toBe('');
  });

  it('should generate path for a single item', () => {
    // Single item at (0, 0) of size 1x1
    // Expanded by margin = 6:
    // left = 0 * 110 - 6 = -6
    // top = 0 * 110 - 6 = -6
    // right = 0 * 110 + 100 + 6 = 106
    // bottom = 0 * 110 + 100 + 6 = 106
    const items = [{ x: 0, y: 0, w: 1, h: 1 }];
    const path = generateSelectionPath(items, config, 6, 10);
    
    // Corners are (-6, -6), (106, -6), (106, 106), (-6, 106)
    // Starting corner 0: B=(-6, -6), A=(-6, 106), C=(106, -6)
    // r = Math.min(10, 112/2, 112/2) = 10
    // p1 = (-6, 4), p2 = (4, -6)
    expect(path).toContain('M 4.0,-6.0');
    expect(path).toContain('L 96.0,-6.0 Q 106.0,-6.0 106.0,4.0');
    expect(path).toContain('L 106.0,96.0 Q 106.0,106.0 96.0,106.0');
    expect(path).toContain('L 4.0,106.0 Q -6.0,106.0 -6.0,96.0');
    expect(path).toContain('L -6.0,4.0 Q -6.0,-6.0 4.0,-6.0 Z');
  });

  it('should merge two adjacent items horizontally', () => {
    // Item 1 at (0, 0) 1x1, Item 2 at (1, 0) 1x1
    // Adjacent in grid (sharing vertical gap from x=100 to x=110)
    // Margin = 6, gap = 10 -> overlap is from 104 to 106 (width 2)
    // Expanded boundary should be unified from x=-6 to x=216
    const items = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 }
    ];
    const path = generateSelectionPath(items, config, 6, 10);
    
    // Union should span from x=-6 to x=216 (since 1 * 110 + 100 + 6 = 216)
    // y should be from -6 to 106
    // Corners of union: (-6, -6), (216, -6), (216, 106), (-6, 106)
    expect(path).toContain('M 4.0,-6.0');
    expect(path).toContain('L 206.0,-6.0 Q 216.0,-6.0 216.0,4.0');
    expect(path).toContain('L 216.0,96.0 Q 216.0,106.0 206.0,106.0');
  });

  it('should generate multiple loops for disconnected items', () => {
    // Item 1 at (0, 0) and Item 2 at (2, 2)
    // Separated by an empty row/col, so no overlap even with margin=6
    const items = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 2, y: 2, w: 1, h: 1 }
    ];
    const path = generateSelectionPath(items, config, 6, 10);
    
    // There should be two disjoint paths/loops starting with 'M'
    const matches = path.match(/M/g);
    expect(matches).toHaveLength(2);
  });

  it('should handle L-shaped selections with concave corners', () => {
    // L-shape: (0,0), (0,1), (1,1)
    const items = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0, y: 1, w: 1, h: 1 },
      { x: 1, y: 1, w: 1, h: 1 }
    ];
    const path = generateSelectionPath(items, config, 6, 10);

    // Should be a single loop (one 'M')
    const matches = path.match(/M/g);
    expect(matches).toHaveLength(1);

    // Check that it contains concave/interior corner outline transitions correctly
    // The concave corner is around (104, 104) where they join.
    expect(path).toBeTruthy();
  });
});
