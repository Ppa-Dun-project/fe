// Vitest global setup — runs once before every test file.
// Adds jest-dom matchers (toBeInTheDocument, etc.) to expect, and between each test
// RTL's cleanup automatically unmounts components and clears the DOM (jsdom + globals: true environment).

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
