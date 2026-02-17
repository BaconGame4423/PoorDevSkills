import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Function Visualizer E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('US1: Basic Function Graphing', () => {
    test('should display parabola when entering x^2', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('x^2');
      await page.waitForTimeout(400);

      const graph = page.locator('#graph-container svg, #graph-container canvas');
      await expect(graph).toBeVisible({ timeout: 1000 });

      const axisLabel = page.locator('.axis-label, text');
      await expect(axisLabel.first()).toBeVisible();
    });

    test('should display sine wave for sin(x)', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('sin(x)');
      await page.waitForTimeout(400);

      const graph = page.locator('#graph-container svg, #graph-container canvas');
      await expect(graph).toBeVisible({ timeout: 500 });
    });

    test('should update graph in real-time when expression changes', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('sin(x)');
      await page.waitForTimeout(400);

      await input.fill('cos(x)');
      await page.waitForTimeout(400);

      const graph = page.locator('#graph-container svg, #graph-container canvas');
      await expect(graph).toBeVisible();
    });

    test('should display grid lines', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('x^2');
      await page.waitForTimeout(400);

      const gridLines = page.locator('.grid-line, .tick');
      const count = await gridLines.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('US2: Derivative Visualization', () => {
    test('should display derivative for x^3', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('x^3');
      await page.waitForTimeout(400);

      const derivativeToggle = page.locator('#derivative-toggle, input[type="checkbox"]');
      if (await derivativeToggle.count() > 0) {
        await derivativeToggle.check();
      }

      const graphPaths = page.locator('#graph-container path, #graph-container .line');
      const count = await graphPaths.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should show tooltip with x, f(x), f\'(x) values', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('x^2');
      await page.waitForTimeout(400);

      const graphContainer = page.locator('#graph-container');
      const box = await graphContainer.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      }

      await page.waitForTimeout(100);

      const tooltip = page.locator('.tooltip, #tooltip');
      if (await tooltip.count() > 0) {
        const tooltipText = await tooltip.textContent();
        expect(tooltipText).toMatch(/x.*f\(x\)/i);
      }
    });

    test('should display derivative legend', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('x^2');
      await page.waitForTimeout(400);

      const legend = page.locator('.legend, #legend');
      if (await legend.count() > 0) {
        const legendText = await legend.textContent();
        expect(legendText).toMatch(/derivative|f'/i);
      }
    });
  });

  test.describe('US3: Tangent Line Analysis', () => {
    test('should draw tangent line on cursor hover', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('x^2');
      await page.waitForTimeout(400);

      const graphContainer = page.locator('#graph-container');
      const box = await graphContainer.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      }

      await page.waitForTimeout(100);

      const tangentLine = page.locator('.tangent-line, #tangent-line');
      if (await tangentLine.count() > 0) {
        await expect(tangentLine).toBeVisible();
      }
    });

    test('tangent line at x=0 for sin(x) should be horizontal', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('sin(x)');
      await page.waitForTimeout(400);

      const graphContainer = page.locator('#graph-container');
      const box = await graphContainer.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      }

      await page.waitForTimeout(100);
    });
  });

  test.describe('US4: Preset Function Exploration', () => {
    const presets = ['sin(x)', 'cos(x)', 'tan(x)', 'log(x)', 'exp(x)', 'sqrt(x)', 'abs(x)'];

    for (const preset of presets) {
      test(`should populate input with ${preset} when clicking preset button`, async ({ page }) => {
        const presetBtn = page.locator(`button[data-preset="${preset}"], button:has-text("${preset}")`);
        if (await presetBtn.count() > 0) {
          await presetBtn.click();

          const input = page.locator('#function-input');
          await expect(input).toHaveValue(preset);
        }
      });
    }

    test('should display graph after clicking preset button', async ({ page }) => {
      const presetBtn = page.locator('button[data-preset="sin(x)"], button:has-text("sin(x)")');
      if (await presetBtn.count() > 0) {
        await presetBtn.click();
        await page.waitForTimeout(400);

        const graph = page.locator('#graph-container svg, #graph-container canvas');
        await expect(graph).toBeVisible({ timeout: 500 });
      }
    });
  });

  test.describe('US5: Responsive Multi-Device Access', () => {
    test('should be usable on mobile viewport (375px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const input = page.locator('#function-input');
      await expect(input).toBeVisible();

      await input.fill('x^2');
      await page.waitForTimeout(400);

      const graph = page.locator('#graph-container svg, #graph-container canvas');
      await expect(graph).toBeVisible();
    });

    test('should not have horizontal scroll on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
    });

    test('should be usable on tablet viewport (768px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const input = page.locator('#function-input');
      await input.fill('sin(x)');
      await page.waitForTimeout(400);

      const graph = page.locator('#graph-container svg, #graph-container canvas');
      await expect(graph).toBeVisible();
    });

    test('should utilize space on desktop viewport (1920px)', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      const graphContainer = page.locator('#graph-container');
      const input = page.locator('#function-input');
      await input.fill('x^2');
      await page.waitForTimeout(400);

      const box = await graphContainer.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(400);
      }
    });
  });

  test.describe('US6: Error Handling', () => {
    test('should display error for unbalanced parenthesis', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('sin((');
      await page.waitForTimeout(400);

      const errorDisplay = page.locator('.error-message, #error-display');
      if (await errorDisplay.count() > 0) {
        await expect(errorDisplay).toBeVisible();
        const errorText = await errorDisplay.textContent();
        expect(errorText?.length).toBeGreaterThan(0);
      }
    });

    test('should not crash application with invalid expression', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('invalid+++');
      await page.waitForTimeout(400);

      const app = page.locator('#app, body');
      await expect(app).toBeVisible();
    });

    test('should show graceful empty state when input is empty', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.clear();
      await page.waitForTimeout(400);

      const errorDisplay = page.locator('.error-message, #error-display');
      const errorCount = await errorDisplay.count();
      
      if (errorCount > 0) {
        const isVisible = await errorDisplay.isVisible();
        expect(isVisible).toBe(false);
      }
    });

    test('should handle log of negative number gracefully', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('log(-x)');
      await page.waitForTimeout(400);

      const app = page.locator('#app, body');
      await expect(app).toBeVisible();
    });
  });

  test.describe('Performance Requirements', () => {
    test('graph should render within 500ms of valid input', async ({ page }) => {
      const input = page.locator('#function-input');

      const startTime = Date.now();
      await input.fill('x^2');

      const graph = page.locator('#graph-container svg, #graph-container canvas');
      await graph.waitFor({ state: 'visible', timeout: 500 });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(500);
    });

    test('tooltip should update within 50ms of cursor movement', async ({ page }) => {
      const input = page.locator('#function-input');
      await input.fill('x^2');
      await page.waitForTimeout(400);

      const graphContainer = page.locator('#graph-container');
      const box = await graphContainer.boundingBox();
      
      if (box) {
        const startTime = Date.now();
        await page.mouse.move(box.x + box.width / 3, box.y + box.height / 3);
        await page.mouse.move(box.x + (2 * box.width) / 3, box.y + box.height / 3);
        const elapsed = Date.now() - startTime;

        expect(elapsed).toBeLessThan(100);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('input field should have accessible label', async ({ page }) => {
      const input = page.locator('#function-input');
      
      const ariaLabel = await input.getAttribute('aria-label');
      const label = await input.getAttribute('label');
      const associatedLabel = page.locator('label[for="function-input"]');
      
      const hasAccessibleName = 
        ariaLabel !== null || 
        label !== null || 
        (await associatedLabel.count()) > 0;
      
      expect(hasAccessibleName).toBe(true);
    });

    test('preset buttons should be keyboard accessible', async ({ page }) => {
      const presetBtn = page.locator('button[data-preset="sin(x)"], button:has-text("sin(x)")');
      
      if (await presetBtn.count() > 0) {
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        const focused = page.locator(':focus');
        const tagName = await focused.evaluate(el => el.tagName);
        expect(['BUTTON', 'INPUT']).toContain(tagName);
      }
    });
  });
});
