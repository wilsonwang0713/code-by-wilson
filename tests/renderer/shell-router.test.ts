import { describe, expect, it } from "vitest";
import { FLOW } from "../../src/shared/terminal";
import { createShellRouter } from "../../src/renderer/src/shell-terminal/router";

function fakeApi() {
  const acks: Array<[string, number]> = [];
  let dataCb: (id: string, data: string, offset: number) => void = () => {};
  let exitCb: (id: string, code: number) => void = () => {};
  return {
    acks,
    emitData: (id: string, data: string) => dataCb(id, data, 0),
    emitExit: (id: string, code: number) => exitCb(id, code),
    api: {
      onData: (cb: typeof dataCb) => {
        dataCb = cb;
        return () => {};
      },
      onExit: (cb: typeof exitCb) => {
        exitCb = cb;
        return () => {};
      },
      ack: (id: string, n: number) => acks.push([id, n]),
    },
  };
}

describe("createShellRouter", () => {
  it("routes data and exit to the registered handler by id", () => {
    const f = fakeApi();
    const router = createShellRouter(f.api);
    const got: string[] = [];
    const exits: number[] = [];
    router.register("a", {
      onData: (d) => got.push(d),
      onExit: (c) => exits.push(c),
    });
    f.emitData("a", "hello");
    f.emitData("b", "stray");
    f.emitExit("a", 0);
    expect(got).toEqual(["hello"]);
    expect(exits).toEqual([0]);
  });

  it("acks stray-id chunks straight back so flow-control credit never leaks", () => {
    const f = fakeApi();
    createShellRouter(f.api);
    f.emitData("ghost", "x".repeat(123));
    expect(f.acks).toEqual([["ghost", 123]]);
  });

  it("acks chunks arriving after unregister (a closed tab mid-flood)", () => {
    const f = fakeApi();
    const router = createShellRouter(f.api);
    const unregister = router.register("a", {
      onData: () => {},
      onExit: () => {},
    });
    unregister();
    f.emitData("a", "late");
    expect(f.acks).toEqual([["a", 4]]);
  });

  it("batches consumed acks into FLOW.ackChars chunks, holding the remainder", () => {
    const f = fakeApi();
    const router = createShellRouter(f.api);
    router.register("a", { onData: () => {}, onExit: () => {} });
    router.ackConsumed("a", FLOW.ackChars - 1);
    expect(f.acks).toEqual([]);
    router.ackConsumed("a", 2); // crosses one batch, remainder 1
    expect(f.acks).toEqual([["a", FLOW.ackChars]]);
    router.ackConsumed("a", FLOW.ackChars * 2); // remainder 1 + 2 batches, remainder 1
    expect(f.acks).toEqual([
      ["a", FLOW.ackChars],
      ["a", FLOW.ackChars],
      ["a", FLOW.ackChars],
    ]);
  });

  it("drops a late ackConsumed for an unregistered id", () => {
    const f = fakeApi();
    const router = createShellRouter(f.api);
    router.ackConsumed("gone", FLOW.ackChars * 3);
    expect(f.acks).toEqual([]);
  });
});
