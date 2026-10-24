import { describe } from "vitest";
import { matrixRows } from "./testing/matrixBot";

describe("real-store difficulty matrix", () => matrixRows("human"));
