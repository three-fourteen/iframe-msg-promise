import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Vitest runs without globals, so Testing Library's automatic cleanup never
// registers itself — unmount between tests explicitly.
afterEach(cleanup)
