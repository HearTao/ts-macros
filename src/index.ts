import * as ts from "typescript";
import { createScanner } from "./scanner";
import { createSourceFile } from "./parser";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

const MutableTs = ts as Mutable<typeof ts>;

MutableTs.createScanner = createScanner;

const code = `const a: () = ();`;
const t = createSourceFile("1.ts", code, ts.ScriptTarget.Latest);
const t1 = ts.createSourceFile("1.ts", code, ts.ScriptTarget.Latest);

const printer = MutableTs.createPrinter();
console.log("code: ", code);
console.log("ts: ", printer.printFile(t1));
console.log("custom: ", printer.printFile(t));
