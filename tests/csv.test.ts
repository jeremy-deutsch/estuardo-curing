import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "csv/sync";
import { downloadCsv } from "../lib/client";

test("note CSV downloads preserve multiline text and protect formula cells", async (context) => {
  let blob: Blob | undefined;
  let downloaded = false;
  const link = {
    href: "",
    download: "",
    click() {
      downloaded = true;
    },
  };
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => link },
  });
  context.mock.method(URL, "createObjectURL", (value: Blob) => {
    blob = value;
    return "blob:notes-test";
  });
  try {
    const body = 'Please call tomorrow.\nThey said "yes", after 5pm. 李';
    downloadCsv("voter-notes.csv", [
      ["Author", "Note"],
      ["=1+1", body],
      ["Taylor", "@SUM(A1)"],
    ]);
    assert.ok(downloaded);
    assert.equal(link.download, "voter-notes.csv");
    assert.ok(blob);
    assert.deepEqual(parse(await blob.text(), { bom: true }), [
      ["Author", "Note"],
      ["'=1+1", body],
      ["Taylor", "'@SUM(A1)"],
    ]);
  } finally {
    if (originalDocument)
      Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
