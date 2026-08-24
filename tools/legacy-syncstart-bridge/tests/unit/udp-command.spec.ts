import { legacyDatagram } from "../../src/legacy/udp-server";
import { LEGACY_OPCODE } from "../../src/legacy/opcodes";

describe("legacy UDP commands", () => {
  it("encodes song selection and synchronized start as opcode plus UTF-8 path", () => {
    expect(legacyDatagram(LEGACY_OPCODE.song, "Pack/Söng")).toEqual(
      Buffer.concat([Buffer.from([0x01]), Buffer.from("Pack/Söng", "utf8")]),
    );
    expect(legacyDatagram(LEGACY_OPCODE.start, "Pack/Song")).toEqual(
      Buffer.concat([Buffer.from([0x00]), Buffer.from("Pack/Song", "utf8")]),
    );
  });

  it("rejects empty and oversized song paths", () => {
    expect(() => legacyDatagram(LEGACY_OPCODE.song, "")).toThrow("Song path is required");
    expect(() => legacyDatagram(LEGACY_OPCODE.song, "a".repeat(1024))).toThrow(
      "Song path exceeds the legacy datagram limit",
    );
  });
});
