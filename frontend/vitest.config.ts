import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    // Match test files in __tests__/ or colocated *.test.{ts,tsx}
    include: ["src/**/*.test.{ts,tsx}", "src/__tests__/**/*.test.{ts,tsx}"],
  },
});
