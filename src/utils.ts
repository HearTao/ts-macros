import { CharacterCodes } from "./types";
import {
  forEachChild,
  reduceEachTrailingCommentRange,
  reduceEachLeadingCommentRange,
  Node,
  SyntaxKind,
  Identifier,
  Token,
  SourceFile,
  SymbolFlags,
  __String,
  ModifierFlags,
  NodeFlags,
  TextRange,
  ScriptKind,
  Extension,
  CommentRange,
  CommentKind,
  DiagnosticMessage,
  DiagnosticWithLocation,
  isStringLiteralLike,
  isNumericLiteral,
  StringLiteralLike,
  NumericLiteral,
  Modifier,
  JSDocContainer,
  HasJSDoc,
  LeftHandSideExpression,
  Expression,
  PartiallyEmittedExpression,
  LiteralExpression,
  Path
} from "typescript";
import { Debug } from "./debug";
import { lastOrUndefined } from "./core";

declare module "typescript" {
  export interface Node extends TextRange {
    /* @internal */ modifierFlagsCache: ModifierFlags;
    /* @internal */ id?: number; // Unique id (used to look up NodeLinks)
    parent: Node; // Parent node (initialized by binding)
    /* @internal */ original?: Node; // The original node if this is an updated node.
  }
  export function reduceEachTrailingCommentRange<T, U>(
    text: string,
    pos: number,
    cb: (
      pos: number,
      end: number,
      kind: CommentKind,
      hasTrailingNewLine: boolean,
      state: T,
      memo: U
    ) => U,
    state: T,
    initial: U
  );
  export function reduceEachLeadingCommentRange<T, U>(
    text: string,
    pos: number,
    cb: (
      pos: number,
      end: number,
      kind: CommentKind,
      hasTrailingNewLine: boolean,
      state: T,
      memo: U
    ) => U,
    state: T,
    initial: U
  );
  export function forEachChild<T>(
    node: Node,
    cbNode: (node: Node) => T | undefined,
    cbNodes?: (nodes: NodeArray<Node>) => T | undefined
  ): T | undefined;
}

export function isNodeKind(kind: SyntaxKind) {
  return kind >= SyntaxKind.FirstNode;
}

export function forEach<T, U>(
  array: ReadonlyArray<T> | undefined,
  callback: (element: T, index: number) => U | undefined
): U | undefined {
  if (array) {
    for (let i = 0; i < array.length; i++) {
      const result = callback(array[i], i);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
}

export const emptyArray: never[] = [] as never[];

export function isKeyword(token: SyntaxKind): boolean {
  return SyntaxKind.FirstKeyword <= token && token <= SyntaxKind.LastKeyword;
}

export interface Push<T> {
  push(...values: T[]): void;
}

export function append<T>(to: T[], value: T | undefined): T[];
export function append<T>(to: T[] | undefined, value: T): T[];
export function append<T>(
  to: T[] | undefined,
  value: T | undefined
): T[] | undefined;
export function append<T>(to: Push<T>, value: T | undefined): void;
export function append<T>(to: T[], value: T | undefined): T[] | undefined {
  if (value === undefined) return to;
  if (to === undefined) return [value];
  to.push(value);
  return to;
}

export function parsePseudoBigInt(stringValue: string): string {
  let log2Base: number;
  switch (
    stringValue.charCodeAt(1) // "x" in "0x123"
  ) {
    case CharacterCodes.b:
    case CharacterCodes.B: // 0b or 0B
      log2Base = 1;
      break;
    case CharacterCodes.o:
    case CharacterCodes.O: // 0o or 0O
      log2Base = 3;
      break;
    case CharacterCodes.x:
    case CharacterCodes.X: // 0x or 0X
      log2Base = 4;
      break;
    default:
      // already in decimal; omit trailing "n"
      const nIndex = stringValue.length - 1;
      // Skip leading 0s
      let nonZeroStart = 0;
      while (stringValue.charCodeAt(nonZeroStart) === CharacterCodes._0) {
        nonZeroStart++;
      }
      return stringValue.slice(nonZeroStart, nIndex) || "0";
  }

  // Omit leading "0b", "0o", or "0x", and trailing "n"
  const startIndex = 2,
    endIndex = stringValue.length - 1;
  const bitsNeeded = (endIndex - startIndex) * log2Base;
  // Stores the value specified by the string as a LE array of 16-bit integers
  // using Uint16 instead of Uint32 so combining steps can use bitwise operators
  const segments = new Uint16Array(
    (bitsNeeded >>> 4) + (bitsNeeded & 15 ? 1 : 0)
  );
  // Add the digits, one at a time
  for (
    let i = endIndex - 1, bitOffset = 0;
    i >= startIndex;
    i--, bitOffset += log2Base
  ) {
    const segment = bitOffset >>> 4;
    const digitChar = stringValue.charCodeAt(i);
    // Find character range: 0-9 < A-F < a-f
    const digit =
      digitChar <= CharacterCodes._9
        ? digitChar - CharacterCodes._0
        : 10 +
          digitChar -
          (digitChar <= CharacterCodes.F ? CharacterCodes.A : CharacterCodes.a);
    const shiftedDigit = digit << (bitOffset & 15);
    segments[segment] |= shiftedDigit;
    const residual = shiftedDigit >>> 16;
    if (residual) segments[segment + 1] |= residual; // overflows segment
  }
  // Repeatedly divide segments by 10 and add remainder to base10Value
  let base10Value = "";
  let firstNonzeroSegment = segments.length - 1;
  let segmentsRemaining = true;
  while (segmentsRemaining) {
    let mod10 = 0;
    segmentsRemaining = false;
    for (let segment = firstNonzeroSegment; segment >= 0; segment--) {
      const newSegment = (mod10 << 16) | segments[segment];
      const segmentValue = (newSegment / 10) | 0;
      segments[segment] = segmentValue;
      mod10 = newSegment - segmentValue * 10;
      if (segmentValue && !segmentsRemaining) {
        firstNonzeroSegment = segment;
        segmentsRemaining = true;
      }
    }
    base10Value = mod10 + base10Value;
  }
  return base10Value;
}

export interface ObjectAllocator {
  getNodeConstructor(): new (
    kind: SyntaxKind,
    pos?: number,
    end?: number
  ) => Node;
  getTokenConstructor(): new <TKind extends SyntaxKind>(
    kind: TKind,
    pos?: number,
    end?: number
  ) => Token<TKind>;
  getIdentifierConstructor(): new (
    kind: SyntaxKind.Identifier,
    pos?: number,
    end?: number
  ) => Identifier;
  getSourceFileConstructor(): new (
    kind: SyntaxKind.SourceFile,
    pos?: number,
    end?: number
  ) => SourceFile;
  getSymbolConstructor(): new (flags: SymbolFlags, name: __String) => Symbol;
}

function Node(this: Node, kind: SyntaxKind, pos: number, end: number) {
  this.pos = pos;
  this.end = end;
  this.kind = kind;
  this.id = 0;
  this.flags = NodeFlags.None;
  this.modifierFlagsCache = ModifierFlags.None;
  this.parent = undefined!;
  this.original = undefined;
}

export let objectAllocator: ObjectAllocator = {
  getNodeConstructor: () => <any>Node,
  getTokenConstructor: () => <any>Node,
  getIdentifierConstructor: () => <any>Node,
  getSourceFileConstructor: () => <any>Node,
  getSymbolConstructor: () => <any>Symbol
};

export function hasModifier(node: Node, flags: ModifierFlags): boolean {
  return !!getSelectedModifierFlags(node, flags);
}

export function getSelectedModifierFlags(
  node: Node,
  flags: ModifierFlags
): ModifierFlags {
  return getModifierFlags(node) & flags;
}

export function getModifierFlags(node: Node): ModifierFlags {
  if (node.modifierFlagsCache & ModifierFlags.HasComputedFlags) {
    return node.modifierFlagsCache & ~ModifierFlags.HasComputedFlags;
  }

  const flags = getModifierFlagsNoCache(node);
  node.modifierFlagsCache = flags | ModifierFlags.HasComputedFlags;
  return flags;
}

export function getModifierFlagsNoCache(node: Node): ModifierFlags {
  let flags = ModifierFlags.None;
  if (node.modifiers) {
    for (const modifier of node.modifiers) {
      flags |= modifierToFlag(modifier.kind);
    }
  }

  if (
    node.flags & NodeFlags.NestedNamespace ||
    (node.kind === SyntaxKind.Identifier &&
      (<Identifier>node).isInJSDocNamespace)
  ) {
    flags |= ModifierFlags.Export;
  }

  return flags;
}

export function ensureScriptKind(
  fileName: string,
  scriptKind: ScriptKind | undefined
): ScriptKind {
  // Using scriptKind as a condition handles both:
  // - 'scriptKind' is unspecified and thus it is `undefined`
  // - 'scriptKind' is set and it is `Unknown` (0)
  // If the 'scriptKind' is 'undefined' or 'Unknown' then we attempt
  // to get the ScriptKind from the file name. If it cannot be resolved
  // from the file name then the default 'TS' script kind is returned.
  return scriptKind || getScriptKindFromFileName(fileName) || ScriptKind.TS;
}

export function getScriptKindFromFileName(fileName: string): ScriptKind {
  const ext = fileName.substr(fileName.lastIndexOf("."));
  switch (ext.toLowerCase()) {
    case Extension.Js:
      return ScriptKind.JS;
    case Extension.Jsx:
      return ScriptKind.JSX;
    case Extension.Ts:
      return ScriptKind.TS;
    case Extension.Tsx:
      return ScriptKind.TSX;
    case Extension.Json:
      return ScriptKind.JSON;
    default:
      return ScriptKind.Unknown;
  }
}

export function mapDefined<T, U>(
  array: ReadonlyArray<T> | undefined,
  mapFn: (x: T, i: number) => U | undefined
): U[] {
  const result: U[] = [];
  if (array) {
    for (let i = 0; i < array.length; i++) {
      const mapped = mapFn(array[i], i);
      if (mapped !== undefined) {
        result.push(mapped);
      }
    }
  }
  return result;
}

export function modifierToFlag(token: SyntaxKind): ModifierFlags {
  switch (token) {
    case SyntaxKind.StaticKeyword:
      return ModifierFlags.Static;
    case SyntaxKind.PublicKeyword:
      return ModifierFlags.Public;
    case SyntaxKind.ProtectedKeyword:
      return ModifierFlags.Protected;
    case SyntaxKind.PrivateKeyword:
      return ModifierFlags.Private;
    case SyntaxKind.AbstractKeyword:
      return ModifierFlags.Abstract;
    case SyntaxKind.ExportKeyword:
      return ModifierFlags.Export;
    case SyntaxKind.DeclareKeyword:
      return ModifierFlags.Ambient;
    case SyntaxKind.ConstKeyword:
      return ModifierFlags.Const;
    case SyntaxKind.DefaultKeyword:
      return ModifierFlags.Default;
    case SyntaxKind.AsyncKeyword:
      return ModifierFlags.Async;
    case SyntaxKind.ReadonlyKeyword:
      return ModifierFlags.Readonly;
  }
  return ModifierFlags.None;
}

export function some<T>(
  array: ReadonlyArray<T> | undefined
): array is ReadonlyArray<T>;
export function some<T>(
  array: ReadonlyArray<T> | undefined,
  predicate: (value: T) => boolean
): boolean;
export function some<T>(
  array: ReadonlyArray<T> | undefined,
  predicate?: (value: T) => boolean
): boolean {
  if (array) {
    if (predicate) {
      for (const v of array) {
        if (predicate(v)) {
          return true;
        }
      }
    } else {
      return array.length > 0;
    }
  }
  return false;
}

export function concatenate<T>(array1: T[], array2: T[]): T[];
export function concatenate<T>(
  array1: ReadonlyArray<T>,
  array2: ReadonlyArray<T>
): ReadonlyArray<T>;
export function concatenate<T>(
  array1: T[] | undefined,
  array2: T[] | undefined
): T[];
export function concatenate<T>(
  array1: ReadonlyArray<T> | undefined,
  array2: ReadonlyArray<T> | undefined
): ReadonlyArray<T>;
export function concatenate<T>(array1: T[], array2: T[]): T[] {
  if (!some(array2)) return array1;
  if (!some(array1)) return array2;
  return [...array1, ...array2];
}

function appendCommentRange(
  pos: number,
  end: number,
  kind: CommentKind,
  hasTrailingNewLine: boolean,
  _state: any,
  comments: CommentRange[]
) {
  if (!comments) {
    comments = [];
  }

  comments.push({ kind, pos, end, hasTrailingNewLine });
  return comments;
}

export function getLeadingCommentRanges(
  text: string,
  pos: number
): CommentRange[] | undefined {
  return reduceEachLeadingCommentRange(
    text,
    pos,
    appendCommentRange,
    /*state*/ undefined,
    /*initial*/ undefined
  );
}

export function getTrailingCommentRanges(
  text: string,
  pos: number
): CommentRange[] | undefined {
  return reduceEachTrailingCommentRange(
    text,
    pos,
    appendCommentRange,
    /*state*/ undefined,
    /*initial*/ undefined
  );
}

export function filter<T, U extends T>(array: T[], f: (x: T) => x is U): U[];
export function filter<T>(array: T[], f: (x: T) => boolean): T[];
export function filter<T, U extends T>(
  array: ReadonlyArray<T>,
  f: (x: T) => x is U
): ReadonlyArray<U>;
export function filter<T, U extends T>(
  array: ReadonlyArray<T>,
  f: (x: T) => boolean
): ReadonlyArray<T>;
export function filter<T, U extends T>(
  array: T[] | undefined,
  f: (x: T) => x is U
): U[] | undefined;
export function filter<T>(
  array: T[] | undefined,
  f: (x: T) => boolean
): T[] | undefined;
export function filter<T, U extends T>(
  array: ReadonlyArray<T> | undefined,
  f: (x: T) => x is U
): ReadonlyArray<U> | undefined;
export function filter<T, U extends T>(
  array: ReadonlyArray<T> | undefined,
  f: (x: T) => boolean
): ReadonlyArray<T> | undefined;
export function filter<T>(
  array: ReadonlyArray<T> | undefined,
  f: (x: T) => boolean
): ReadonlyArray<T> | undefined {
  if (array) {
    const len = array.length;
    let i = 0;
    while (i < len && f(array[i])) i++;
    if (i < len) {
      const result = array.slice(0, i);
      i++;
      while (i < len) {
        const item = array[i];
        if (f(item)) {
          result.push(item);
        }
        i++;
      }
      return result;
    }
  }
  return array;
}

export function getJSDocCommentRanges(node: Node, text: string) {
  const commentRanges =
    node.kind === SyntaxKind.Parameter ||
    node.kind === SyntaxKind.TypeParameter ||
    node.kind === SyntaxKind.FunctionExpression ||
    node.kind === SyntaxKind.ArrowFunction ||
    node.kind === SyntaxKind.ParenthesizedExpression
      ? concatenate(
          getTrailingCommentRanges(text, node.pos),
          getLeadingCommentRanges(text, node.pos)
        )
      : getLeadingCommentRanges(text, node.pos);
  // True if the comment starts with '/**' but not if it is '/**/'
  return filter(
    commentRanges,
    comment =>
      text.charCodeAt(comment.pos + 1) === CharacterCodes.asterisk &&
      text.charCodeAt(comment.pos + 2) === CharacterCodes.asterisk &&
      text.charCodeAt(comment.pos + 3) !== CharacterCodes.slash
  );
}

export function formatStringFromArgs(
  text: string,
  args: ArrayLike<string | number>,
  baseIndex = 0
): string {
  return text.replace(
    /{(\d+)}/g,
    (_match, index: string) =>
      "" + Debug.assertDefined(args[+index + baseIndex])
  );
}

export function getLocaleSpecificMessage(message: DiagnosticMessage) {
  return message.message;
}

export function createFileDiagnostic(
  file: SourceFile,
  start: number,
  length: number,
  message: DiagnosticMessage,
  ...args: (string | number | undefined)[]
): DiagnosticWithLocation;
export function createFileDiagnostic(
  file: SourceFile,
  start: number,
  length: number,
  message: DiagnosticMessage
): DiagnosticWithLocation {
  Debug.assertGreaterThanOrEqual(start, 0);
  Debug.assertGreaterThanOrEqual(length, 0);

  if (file) {
    Debug.assertLessThanOrEqual(start, file.text.length);
    Debug.assertLessThanOrEqual(start + length, file.text.length);
  }

  let text = getLocaleSpecificMessage(message);

  if (arguments.length > 4) {
    text = formatStringFromArgs(text, arguments, 4);
  }

  return {
    file,
    start,
    length,

    messageText: text,
    category: message.category,
    code: message.code,
    reportsUnnecessary: message.reportsUnnecessary
  };
}

export function nodeIsMissing(node: Node | undefined): boolean {
  if (node === undefined) {
    return true;
  }

  return (
    node.pos === node.end &&
    node.pos >= 0 &&
    node.kind !== SyntaxKind.EndOfFileToken
  );
}

export function isStringOrNumericLiteralLike(
  node: Node
): node is StringLiteralLike | NumericLiteral {
  return isStringLiteralLike(node) || isNumericLiteral(node);
}

export function nodeIsPresent(node: Node | undefined): boolean {
  return !nodeIsMissing(node);
}

export function isAssignmentOperator(token: SyntaxKind): boolean {
  return (
    token >= SyntaxKind.FirstAssignment && token <= SyntaxKind.LastAssignment
  );
}
export function skipPartiallyEmittedExpressions(node: Expression): Expression;
export function skipPartiallyEmittedExpressions(node: Node): Node;
export function skipPartiallyEmittedExpressions(node: Node) {
  while (node.kind === SyntaxKind.PartiallyEmittedExpression) {
    node = (<PartiallyEmittedExpression>node).expression;
  }

  return node;
}

export function isLeftHandSideExpression(
  node: Node
): node is LeftHandSideExpression {
  return isLeftHandSideExpressionKind(
    skipPartiallyEmittedExpressions(node).kind
  );
}

function isLeftHandSideExpressionKind(kind: SyntaxKind): boolean {
  switch (kind) {
    case SyntaxKind.PropertyAccessExpression:
    case SyntaxKind.ElementAccessExpression:
    case SyntaxKind.NewExpression:
    case SyntaxKind.CallExpression:
    case SyntaxKind.JsxElement:
    case SyntaxKind.JsxSelfClosingElement:
    case SyntaxKind.JsxFragment:
    case SyntaxKind.TaggedTemplateExpression:
    case SyntaxKind.ArrayLiteralExpression:
    case SyntaxKind.ParenthesizedExpression:
    case SyntaxKind.ObjectLiteralExpression:
    case SyntaxKind.ClassExpression:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.Identifier:
    case SyntaxKind.RegularExpressionLiteral:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.BigIntLiteral:
    case SyntaxKind.StringLiteral:
    case SyntaxKind.NoSubstitutionTemplateLiteral:
    case SyntaxKind.TemplateExpression:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NullKeyword:
    case SyntaxKind.ThisKeyword:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.SuperKeyword:
    case SyntaxKind.NonNullExpression:
    case SyntaxKind.MetaProperty:
    case SyntaxKind.ImportKeyword: // technically this is only an Expression if it's in a CallExpression
      return true;
    default:
      return false;
  }
}

export function getBinaryOperatorPrecedence(kind: SyntaxKind): number {
  switch (kind) {
    case SyntaxKind.BarBarToken:
      return 5;
    case SyntaxKind.AmpersandAmpersandToken:
      return 6;
    case SyntaxKind.BarToken:
      return 7;
    case SyntaxKind.CaretToken:
      return 8;
    case SyntaxKind.AmpersandToken:
      return 9;
    case SyntaxKind.EqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsToken:
    case SyntaxKind.EqualsEqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsEqualsToken:
      return 10;
    case SyntaxKind.LessThanToken:
    case SyntaxKind.GreaterThanToken:
    case SyntaxKind.LessThanEqualsToken:
    case SyntaxKind.GreaterThanEqualsToken:
    case SyntaxKind.InstanceOfKeyword:
    case SyntaxKind.InKeyword:
    case SyntaxKind.AsKeyword:
      return 11;
    case SyntaxKind.LessThanLessThanToken:
    case SyntaxKind.GreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
      return 12;
    case SyntaxKind.PlusToken:
    case SyntaxKind.MinusToken:
      return 13;
    case SyntaxKind.AsteriskToken:
    case SyntaxKind.SlashToken:
    case SyntaxKind.PercentToken:
      return 14;
    case SyntaxKind.AsteriskAsteriskToken:
      return 15;
  }

  // -1 is lower than all other precedences.  Returning it will cause binary expression
  // parsing to stop.
  return -1;
}

export type TriviaKind =
  | SyntaxKind.SingleLineCommentTrivia
  | SyntaxKind.MultiLineCommentTrivia
  | SyntaxKind.NewLineTrivia
  | SyntaxKind.WhitespaceTrivia
  | SyntaxKind.ShebangTrivia
  | SyntaxKind.ConflictMarkerTrivia;
export function isTrivia(token: SyntaxKind): token is TriviaKind {
  return (
    SyntaxKind.FirstTriviaToken <= token && token <= SyntaxKind.LastTriviaToken
  );
}

export function getLastChild(node: Node): Node | undefined {
  let lastChild: Node | undefined;
  forEachChild(
    node,
    child => {
      if (nodeIsPresent(child)) lastChild = child;
    },
    children => {
      // As an optimization, jump straight to the end of the list.
      for (let i = children.length - 1; i >= 0; i--) {
        if (nodeIsPresent(children[i])) {
          lastChild = children[i];
          break;
        }
      }
    }
  );
  return lastChild;
}

export function isParameterPropertyModifier(kind: SyntaxKind): boolean {
  return !!(modifierToFlag(kind) & ModifierFlags.ParameterPropertyModifier);
}

/* @internal */
export function isClassMemberModifier(idToken: SyntaxKind): boolean {
  return (
    isParameterPropertyModifier(idToken) || idToken === SyntaxKind.StaticKeyword
  );
}

export function hasJSDocNodes(node: Node): node is HasJSDoc {
  const { jsDoc } = node as JSDocContainer;
  return !!jsDoc && jsDoc.length > 0;
}

export function isModifierKind(token: SyntaxKind): token is Modifier["kind"] {
  switch (token) {
    case SyntaxKind.AbstractKeyword:
    case SyntaxKind.AsyncKeyword:
    case SyntaxKind.ConstKeyword:
    case SyntaxKind.DeclareKeyword:
    case SyntaxKind.DefaultKeyword:
    case SyntaxKind.ExportKeyword:
    case SyntaxKind.PublicKeyword:
    case SyntaxKind.PrivateKeyword:
    case SyntaxKind.ProtectedKeyword:
    case SyntaxKind.ReadonlyKeyword:
    case SyntaxKind.StaticKeyword:
      return true;
  }
  return false;
}

export function hasModifiers(node: Node) {
  return getModifierFlags(node) !== ModifierFlags.None;
}

export function getFullWidth(node: Node) {
  return node.end - node.pos;
}

export function containsParseError(node: Node): boolean {
  aggregateChildData(node);
  return (node.flags & NodeFlags.ThisNodeOrAnySubNodesHasError) !== 0;
}

export function isLiteralKind(kind: SyntaxKind): boolean {
  return (
    SyntaxKind.FirstLiteralToken <= kind && kind <= SyntaxKind.LastLiteralToken
  );
}

export function isLiteralExpression(node: Node): node is LiteralExpression {
  return isLiteralKind(node.kind);
}

// Pseudo-literals

/* @internal */
export function isTemplateLiteralKind(kind: SyntaxKind): boolean {
  return (
    SyntaxKind.FirstTemplateToken <= kind &&
    kind <= SyntaxKind.LastTemplateToken
  );
}

function aggregateChildData(node: Node): void {
  if (!(node.flags & NodeFlags.HasAggregatedChildData)) {
    // A node is considered to contain a parse error if:
    //  a) the parser explicitly marked that it had an error
    //  b) any of it's children reported that it had an error.
    const thisNodeOrAnySubNodesHasError =
      (node.flags & NodeFlags.ThisNodeHasError) !== 0 ||
      forEachChild(node, containsParseError);

    // If so, mark ourselves accordingly.
    if (thisNodeOrAnySubNodesHasError) {
      node.flags |= NodeFlags.ThisNodeOrAnySubNodesHasError;
    }

    // Also mark that we've propagated the child information to this node.  This way we can
    // always consult the bit directly on this node without needing to check its children
    // again.
    node.flags |= NodeFlags.HasAggregatedChildData;
  }
}

export function normalizePath(path: string): string {
  return resolvePath(path);
}

export function normalizeSlashes(path: string): string {
  return path.replace(backslashRegExp, directorySeparator);
}

export const directorySeparator = "/";
const altDirectorySeparator = "\\";
const urlSchemeSeparator = "://";
const backslashRegExp = /\\/g;

function isVolumeCharacter(charCode: number) {
  return (
    (charCode >= CharacterCodes.a && charCode <= CharacterCodes.z) ||
    (charCode >= CharacterCodes.A && charCode <= CharacterCodes.Z)
  );
}

function getFileUrlVolumeSeparatorEnd(url: string, start: number) {
  const ch0 = url.charCodeAt(start);
  if (ch0 === CharacterCodes.colon) return start + 1;
  if (
    ch0 === CharacterCodes.percent &&
    url.charCodeAt(start + 1) === CharacterCodes._3
  ) {
    const ch2 = url.charCodeAt(start + 2);
    if (ch2 === CharacterCodes.a || ch2 === CharacterCodes.A) return start + 3;
  }
  return -1;
}

function getEncodedRootLength(path: string): number {
  if (!path) return 0;
  const ch0 = path.charCodeAt(0);

  // POSIX or UNC
  if (ch0 === CharacterCodes.slash || ch0 === CharacterCodes.backslash) {
    if (path.charCodeAt(1) !== ch0) return 1; // POSIX: "/" (or non-normalized "\")

    const p1 = path.indexOf(
      ch0 === CharacterCodes.slash ? directorySeparator : altDirectorySeparator,
      2
    );
    if (p1 < 0) return path.length; // UNC: "//server" or "\\server"

    return p1 + 1; // UNC: "//server/" or "\\server\"
  }

  // DOS
  if (isVolumeCharacter(ch0) && path.charCodeAt(1) === CharacterCodes.colon) {
    const ch2 = path.charCodeAt(2);
    if (ch2 === CharacterCodes.slash || ch2 === CharacterCodes.backslash)
      return 3; // DOS: "c:/" or "c:\"
    if (path.length === 2) return 2; // DOS: "c:" (but not "c:d")
  }

  // URL
  const schemeEnd = path.indexOf(urlSchemeSeparator);
  if (schemeEnd !== -1) {
    const authorityStart = schemeEnd + urlSchemeSeparator.length;
    const authorityEnd = path.indexOf(directorySeparator, authorityStart);
    if (authorityEnd !== -1) {
      // URL: "file:///", "file://server/", "file://server/path"
      // For local "file" URLs, include the leading DOS volume (if present).
      // Per https://www.ietf.org/rfc/rfc1738.txt, a host of "" or "localhost" is a
      // special case interpreted as "the machine from which the URL is being interpreted".
      const scheme = path.slice(0, schemeEnd);
      const authority = path.slice(authorityStart, authorityEnd);
      if (
        scheme === "file" &&
        (authority === "" || authority === "localhost") &&
        isVolumeCharacter(path.charCodeAt(authorityEnd + 1))
      ) {
        const volumeSeparatorEnd = getFileUrlVolumeSeparatorEnd(
          path,
          authorityEnd + 2
        );
        if (volumeSeparatorEnd !== -1) {
          if (path.charCodeAt(volumeSeparatorEnd) === CharacterCodes.slash) {
            // URL: "file:///c:/", "file://localhost/c:/", "file:///c%3a/", "file://localhost/c%3a/"
            return ~(volumeSeparatorEnd + 1);
          }
          if (volumeSeparatorEnd === path.length) {
            // URL: "file:///c:", "file://localhost/c:", "file:///c$3a", "file://localhost/c%3a"
            // but not "file:///c:d" or "file:///c%3ad"
            return ~volumeSeparatorEnd;
          }
        }
      }
      return ~(authorityEnd + 1); // URL: "file://server/", "http://server/"
    }
    return ~path.length; // URL: "file://server", "http://server"
  }

  // relative
  return 0;
}

export function getRootLength(path: string) {
  const rootLength = getEncodedRootLength(path);
  return rootLength < 0 ? ~rootLength : rootLength;
}

export function hasTrailingDirectorySeparator(path: string) {
  if (path.length === 0) return false;
  const ch = path.charCodeAt(path.length - 1);
  return ch === CharacterCodes.slash || ch === CharacterCodes.backslash;
}

export function ensureTrailingDirectorySeparator(path: Path): Path;
export function ensureTrailingDirectorySeparator(path: string): string;
export function ensureTrailingDirectorySeparator(path: string) {
  if (!hasTrailingDirectorySeparator(path)) {
    return path + directorySeparator;
  }

  return path;
}

export function combinePaths(
  path: string,
  ...paths: (string | undefined)[]
): string {
  if (path) path = normalizeSlashes(path);
  for (let relativePath of paths) {
    if (!relativePath) continue;
    relativePath = normalizeSlashes(relativePath);
    if (!path || getRootLength(relativePath) !== 0) {
      path = relativePath;
    } else {
      path = ensureTrailingDirectorySeparator(path) + relativePath;
    }
  }
  return path;
}
export function getPathFromPathComponents(
  pathComponents: ReadonlyArray<string>
) {
  if (pathComponents.length === 0) return "";

  const root =
    pathComponents[0] && ensureTrailingDirectorySeparator(pathComponents[0]);
  return root + pathComponents.slice(1).join(directorySeparator);
}
export function reducePathComponents(components: ReadonlyArray<string>) {
  if (!some(components)) return [];
  const reduced = [components[0]];
  for (let i = 1; i < components.length; i++) {
    const component = components[i];
    if (!component) continue;
    if (component === ".") continue;
    if (component === "..") {
      if (reduced.length > 1) {
        if (reduced[reduced.length - 1] !== "..") {
          reduced.pop();
          continue;
        }
      } else if (reduced[0]) continue;
    }
    reduced.push(component);
  }
  return reduced;
}

function pathComponents(path: string, rootLength: number) {
  const root = path.substring(0, rootLength);
  const rest = path.substring(rootLength).split(directorySeparator);
  if (rest.length && !lastOrUndefined(rest)) rest.pop();
  return [root, ...rest];
}

export function getPathComponents(path: string, currentDirectory = "") {
  path = combinePaths(currentDirectory, path);
  const rootLength = getRootLength(path);
  return pathComponents(path, rootLength);
}

export function resolvePath(
  path: string,
  ...paths: (string | undefined)[]
): string {
  const combined = some(paths)
    ? combinePaths(path, ...paths)
    : normalizeSlashes(path);
  const normalized = getPathFromPathComponents(
    reducePathComponents(getPathComponents(combined))
  );
  return normalized && hasTrailingDirectorySeparator(combined)
    ? ensureTrailingDirectorySeparator(normalized)
    : normalized;
}
