import { parseMinimumAmountInput, parseDuplicateTimeoutInput } from "../settingsInputParsing";

describe("parseMinimumAmountInput", () => {
  it("converts whole rupees to paise", () => {
    expect(parseMinimumAmountInput("50")).toBe(5000);
  });

  it("converts decimal rupees to paise", () => {
    expect(parseMinimumAmountInput("12.5")).toBe(1250);
  });

  it("falls back to 0 for empty input", () => {
    expect(parseMinimumAmountInput("")).toBe(0);
  });

  it("falls back to 0 for non-numeric input", () => {
    expect(parseMinimumAmountInput("abc")).toBe(0);
  });

  it("falls back to 0 for negative input", () => {
    expect(parseMinimumAmountInput("-5")).toBe(0);
  });

  it("rounds sub-paise floating point noise", () => {
    expect(parseMinimumAmountInput("9.999")).toBe(1000);
  });
});

describe("parseDuplicateTimeoutInput", () => {
  it("parses a whole-number seconds value", () => {
    expect(parseDuplicateTimeoutInput("45")).toBe(45);
  });

  it("falls back to the 30s default for empty input", () => {
    expect(parseDuplicateTimeoutInput("")).toBe(30);
  });

  it("falls back to the 30s default for non-numeric input", () => {
    expect(parseDuplicateTimeoutInput("abc")).toBe(30);
  });

  it("falls back to the 30s default for negative input", () => {
    expect(parseDuplicateTimeoutInput("-10")).toBe(30);
  });

  it("allows zero (no dedup window)", () => {
    expect(parseDuplicateTimeoutInput("0")).toBe(0);
  });
});
