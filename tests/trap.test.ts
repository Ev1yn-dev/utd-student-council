import { describe, expect, it } from "vitest";
import { blockedUntil, cymruOrigin } from "../lib/trap";

describe("cymruOrigin", () => {
  it("reverses IPv4 octets", () => {
    expect(cymruOrigin("8.8.4.1")).toBe("1.4.8.8.origin.asn.cymru.com");
  });
  it("expands and reverses IPv6 nibbles", () => {
    expect(cymruOrigin("2001:db8::1")).toBe(`1.${"0.".repeat(23)}8.b.d.0.1.0.0.2.origin6.asn.cymru.com`);
  });
  it("rejects anything else", () => {
    expect(cymruOrigin("unknown")).toBeNull();
    expect(cymruOrigin("example.com")).toBeNull();
  });
});

describe("blockedUntil", () => {
  it("never blocks an unknown IP and fails open without a database", async () => {
    expect(await blockedUntil("unknown")).toBeNull();
    expect(await blockedUntil("203.0.113.9")).toBeNull();
  });
});
