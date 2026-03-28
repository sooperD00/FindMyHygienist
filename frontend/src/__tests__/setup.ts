/**
 * Vitest global setup — runs before each test file.
 *
 * Registers @testing-library/jest-dom matchers so you can write
 * expect(element).toBeInTheDocument() etc. in component tests.
 */
import "@testing-library/jest-dom/vitest";
