import { CommentRange, NodeArray, Iterator, Map, Node } from "typescript";

export const enum CharacterCodes {
  nullCharacter = 0,
  maxAsciiCharacter = 0x7f,

  lineFeed = 0x0a, // \n
  carriageReturn = 0x0d, // \r
  lineSeparator = 0x2028,
  paragraphSeparator = 0x2029,
  nextLine = 0x0085,

  // Unicode 3.0 space characters
  space = 0x0020, // " "
  nonBreakingSpace = 0x00a0, //
  enQuad = 0x2000,
  emQuad = 0x2001,
  enSpace = 0x2002,
  emSpace = 0x2003,
  threePerEmSpace = 0x2004,
  fourPerEmSpace = 0x2005,
  sixPerEmSpace = 0x2006,
  figureSpace = 0x2007,
  punctuationSpace = 0x2008,
  thinSpace = 0x2009,
  hairSpace = 0x200a,
  zeroWidthSpace = 0x200b,
  narrowNoBreakSpace = 0x202f,
  ideographicSpace = 0x3000,
  mathematicalSpace = 0x205f,
  ogham = 0x1680,

  _ = 0x5f,
  $ = 0x24,

  _0 = 0x30,
  _1 = 0x31,
  _2 = 0x32,
  _3 = 0x33,
  _4 = 0x34,
  _5 = 0x35,
  _6 = 0x36,
  _7 = 0x37,
  _8 = 0x38,
  _9 = 0x39,

  a = 0x61,
  b = 0x62,
  c = 0x63,
  d = 0x64,
  e = 0x65,
  f = 0x66,
  g = 0x67,
  h = 0x68,
  i = 0x69,
  j = 0x6a,
  k = 0x6b,
  l = 0x6c,
  m = 0x6d,
  n = 0x6e,
  o = 0x6f,
  p = 0x70,
  q = 0x71,
  r = 0x72,
  s = 0x73,
  t = 0x74,
  u = 0x75,
  v = 0x76,
  w = 0x77,
  x = 0x78,
  y = 0x79,
  z = 0x7a,

  A = 0x41,
  B = 0x42,
  C = 0x43,
  D = 0x44,
  E = 0x45,
  F = 0x46,
  G = 0x47,
  H = 0x48,
  I = 0x49,
  J = 0x4a,
  K = 0x4b,
  L = 0x4c,
  M = 0x4d,
  N = 0x4e,
  O = 0x4f,
  P = 0x50,
  Q = 0x51,
  R = 0x52,
  S = 0x53,
  T = 0x54,
  U = 0x55,
  V = 0x56,
  W = 0x57,
  X = 0x58,
  Y = 0x59,
  Z = 0x5a,

  ampersand = 0x26, // &
  asterisk = 0x2a, // *
  at = 0x40, // @
  backslash = 0x5c, // \
  backtick = 0x60, // `
  bar = 0x7c, // |
  caret = 0x5e, // ^
  closeBrace = 0x7d, // }
  closeBracket = 0x5d, // ]
  closeParen = 0x29, // )
  colon = 0x3a, // :
  comma = 0x2c, // ,
  dot = 0x2e, // .
  doubleQuote = 0x22, // "
  equals = 0x3d, // =
  exclamation = 0x21, // !
  greaterThan = 0x3e, // >
  hash = 0x23, // #
  lessThan = 0x3c, // <
  minus = 0x2d, // -
  openBrace = 0x7b, // {
  openBracket = 0x5b, // [
  openParen = 0x28, // (
  percent = 0x25, // %
  plus = 0x2b, // +
  question = 0x3f, // ?
  semicolon = 0x3b, // ;
  singleQuote = 0x27, // '
  slash = 0x2f, // /
  tilde = 0x7e, // ~

  backspace = 0x08, // \b
  formFeed = 0x0c, // \f
  byteOrderMark = 0xfeff,
  tab = 0x09, // \t
  verticalTab = 0x0b // \v
}

export const enum TokenFlags {
  None = 0,
  /* @internal */
  PrecedingLineBreak = 1 << 0,
  /* @internal */
  PrecedingJSDocComment = 1 << 1,
  /* @internal */
  Unterminated = 1 << 2,
  /* @internal */
  ExtendedUnicodeEscape = 1 << 3,
  Scientific = 1 << 4, // e.g. `10e2`
  Octal = 1 << 5, // e.g. `0777`
  HexSpecifier = 1 << 6, // e.g. `0x00000000`
  BinarySpecifier = 1 << 7, // e.g. `0b0110010000000000`
  OctalSpecifier = 1 << 8, // e.g. `0o777`
  ContainsSeparator = 1 << 9, // e.g. `0b1100_0101`
  BinaryOrOctalSpecifier = BinarySpecifier | OctalSpecifier,
  NumericLiteralFlags = Scientific |
    Octal |
    HexSpecifier |
    BinaryOrOctalSpecifier |
    ContainsSeparator
}

/** ES6 Map interface, only read methods included. */
export interface ReadonlyMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(action: (value: T, key: string) => void): void;
  readonly size: number;
  keys(): Iterator<string>;
  values(): Iterator<T>;
  entries(): Iterator<[string, T]>;
}

export interface MapLike<T> {
  [index: string]: T;
}

export const enum NodeFlags {
  None = 0,
  Let = 1 << 0, // Variable declaration
  Const = 1 << 1, // Variable declaration
  NestedNamespace = 1 << 2, // Namespace declaration
  Synthesized = 1 << 3, // Node was synthesized during transformation
  Namespace = 1 << 4, // Namespace declaration
  ExportContext = 1 << 5, // Export context (initialized by binding)
  ContainsThis = 1 << 6, // Interface contains references to "this"
  HasImplicitReturn = 1 << 7, // If function implicitly returns on one of codepaths (initialized by binding)
  HasExplicitReturn = 1 << 8, // If function has explicit reachable return on one of codepaths (initialized by binding)
  GlobalAugmentation = 1 << 9, // Set if module declaration is an augmentation for the global scope
  HasAsyncFunctions = 1 << 10, // If the file has async functions (initialized by binding)
  DisallowInContext = 1 << 11, // If node was parsed in a context where 'in-expressions' are not allowed
  YieldContext = 1 << 12, // If node was parsed in the 'yield' context created when parsing a generator
  DecoratorContext = 1 << 13, // If node was parsed as part of a decorator
  AwaitContext = 1 << 14, // If node was parsed in the 'await' context created when parsing an async function
  ThisNodeHasError = 1 << 15, // If the parser encountered an error when parsing the code that created this node
  JavaScriptFile = 1 << 16, // If node was parsed in a JavaScript
  ThisNodeOrAnySubNodesHasError = 1 << 17, // If this node or any of its children had an error
  HasAggregatedChildData = 1 << 18, // If we've computed data from children and cached it in this node

  // These flags will be set when the parser encounters a dynamic import expression or 'import.meta' to avoid
  // walking the tree if the flags are not set. However, these flags are just a approximation
  // (hence why it's named "PossiblyContainsDynamicImport") because once set, the flags never get cleared.
  // During editing, if a dynamic import is removed, incremental parsing will *NOT* clear this flag.
  // This means that the tree will always be traversed during module resolution, or when looking for external module indicators.
  // However, the removal operation should not occur often and in the case of the
  // removal, it is likely that users will add the import anyway.
  // The advantage of this approach is its simplicity. For the case of batch compilation,
  // we guarantee that users won't have to pay the price of walking the tree if a dynamic import isn't used.
  /* @internal */ PossiblyContainsDynamicImport = 1 << 19,
  /* @internal */ PossiblyContainsImportMeta = 1 << 20,

  JSDoc = 1 << 21, // If node was parsed inside jsdoc
  /* @internal */ Ambient = 1 << 22, // If node was inside an ambient context -- a declaration file, or inside something with the `declare` modifier.
  /* @internal */ InWithStatement = 1 << 23, // If any ancestor of node was the `statement` of a WithStatement (not the `expression`)
  JsonFile = 1 << 24, // If node was parsed in a Json

  BlockScoped = Let | Const,

  ReachabilityCheckFlags = HasImplicitReturn | HasExplicitReturn,
  ReachabilityAndEmitFlags = ReachabilityCheckFlags | HasAsyncFunctions,

  // Parsing context flags
  ContextFlags = DisallowInContext |
    YieldContext |
    DecoratorContext |
    AwaitContext |
    JavaScriptFile |
    InWithStatement |
    Ambient,

  // Exclude these flags when parsing a Type
  TypeExcludesFlags = YieldContext | AwaitContext,

  // Represents all flags that are potentially set once and
  // never cleared on SourceFiles which get re-used in between incremental parses.
  // See the comment above on `PossiblyContainsDynamicImport` and `PossiblyContainsImportMeta`.
  /* @internal */ PermanentlySetIncrementalFlags = PossiblyContainsDynamicImport |
    PossiblyContainsImportMeta
}

export const enum PragmaKindFlags {
  None = 0,
  /**
   * Triple slash comment of the form
   * /// <pragma-name argname="value" />
   */
  TripleSlashXML = 1 << 0,
  /**
   * Single line comment of the form
   * // @pragma-name argval1 argval2
   * or
   * /// @pragma-name argval1 argval2
   */
  SingleLine = 1 << 1,
  /**
   * Multiline non-jsdoc pragma of the form
   * /* @pragma-name argval1 argval2 * /
   */
  MultiLine = 1 << 2,
  All = TripleSlashXML | SingleLine | MultiLine,
  Default = All
}

interface PragmaArgumentSpecification<TName extends string> {
  name: TName; // Determines the name of the key in the resulting parsed type, type parameter to cause literal type inference
  optional?: boolean;
  captureSpan?: boolean;
}

export interface PragmaDefinition<
  T1 extends string = string,
  T2 extends string = string,
  T3 extends string = string,
  T4 extends string = string
> {
  args?:
    | [PragmaArgumentSpecification<T1>]
    | [PragmaArgumentSpecification<T1>, PragmaArgumentSpecification<T2>]
    | [
        PragmaArgumentSpecification<T1>,
        PragmaArgumentSpecification<T2>,
        PragmaArgumentSpecification<T3>
      ]
    | [
        PragmaArgumentSpecification<T1>,
        PragmaArgumentSpecification<T2>,
        PragmaArgumentSpecification<T3>,
        PragmaArgumentSpecification<T4>
      ];
  // If not present, defaults to PragmaKindFlags.Default
  kind?: PragmaKindFlags;
}

function _contextuallyTypePragmas<
  T extends { [name: string]: PragmaDefinition<K1, K2, K3, K4> },
  K1 extends string,
  K2 extends string,
  K3 extends string,
  K4 extends string
>(args: T): T {
  return args;
}

export const commentPragmas = _contextuallyTypePragmas({
  reference: {
    args: [
      { name: "types", optional: true, captureSpan: true },
      { name: "lib", optional: true, captureSpan: true },
      { name: "path", optional: true, captureSpan: true },
      { name: "no-default-lib", optional: true }
    ],
    kind: PragmaKindFlags.TripleSlashXML
  },
  "amd-dependency": {
    args: [{ name: "path" }, { name: "name", optional: true }],
    kind: PragmaKindFlags.TripleSlashXML
  },
  "amd-module": {
    args: [{ name: "name" }],
    kind: PragmaKindFlags.TripleSlashXML
  },
  "ts-check": {
    kind: PragmaKindFlags.SingleLine
  },
  "ts-nocheck": {
    kind: PragmaKindFlags.SingleLine
  },
  jsx: {
    args: [{ name: "factory" }],
    kind: PragmaKindFlags.MultiLine
  }
});

type ConcretePragmaSpecs = typeof commentPragmas;

type PragmaArgTypeMaybeCapture<TDesc> = TDesc extends { captureSpan: true }
  ? { value: string; pos: number; end: number }
  : string;

type PragmaArgTypeOptional<TDesc, TName extends string> = TDesc extends {
  optional: true;
}
  ? { [K in TName]?: PragmaArgTypeMaybeCapture<TDesc> }
  : { [K in TName]: PragmaArgTypeMaybeCapture<TDesc> };

type PragmaArgumentType<T extends PragmaDefinition> = T extends {
  args: [
    PragmaArgumentSpecification<infer TName1>,
    PragmaArgumentSpecification<infer TName2>,
    PragmaArgumentSpecification<infer TName3>,
    PragmaArgumentSpecification<infer TName4>
  ];
}
  ? PragmaArgTypeOptional<T["args"][0], TName1> &
      PragmaArgTypeOptional<T["args"][1], TName2> &
      PragmaArgTypeOptional<T["args"][2], TName3> &
      PragmaArgTypeOptional<T["args"][2], TName4>
  : T extends {
      args: [
        PragmaArgumentSpecification<infer TName1>,
        PragmaArgumentSpecification<infer TName2>,
        PragmaArgumentSpecification<infer TName3>
      ];
    }
  ? PragmaArgTypeOptional<T["args"][0], TName1> &
      PragmaArgTypeOptional<T["args"][1], TName2> &
      PragmaArgTypeOptional<T["args"][2], TName3>
  : T extends {
      args: [
        PragmaArgumentSpecification<infer TName1>,
        PragmaArgumentSpecification<infer TName2>
      ];
    }
  ? PragmaArgTypeOptional<T["args"][0], TName1> &
      PragmaArgTypeOptional<T["args"][1], TName2>
  : T extends { args: [PragmaArgumentSpecification<infer TName>] }
  ? PragmaArgTypeOptional<T["args"][0], TName>
  : object;

export type PragmaPseudoMap = {
  [K in keyof ConcretePragmaSpecs]?: {
    arguments: PragmaArgumentType<ConcretePragmaSpecs[K]>;
    range: CommentRange;
  }
};

/* @internal */
export type PragmaPseudoMapEntry = {
  [K in keyof PragmaPseudoMap]: { name: K; args: PragmaPseudoMap[K] }
}[keyof PragmaPseudoMap];

/* @internal */
export interface ReadonlyPragmaMap
  extends ReadonlyMap<
    | PragmaPseudoMap[keyof PragmaPseudoMap]
    | PragmaPseudoMap[keyof PragmaPseudoMap][]
  > {
  get<TKey extends keyof PragmaPseudoMap>(
    key: TKey
  ): PragmaPseudoMap[TKey] | PragmaPseudoMap[TKey][];
  forEach(
    action: <TKey extends keyof PragmaPseudoMap>(
      value: PragmaPseudoMap[TKey] | PragmaPseudoMap[TKey][],
      key: TKey
    ) => void
  ): void;
}

export interface PragmaMap
  extends Map<
      | PragmaPseudoMap[keyof PragmaPseudoMap]
      | PragmaPseudoMap[keyof PragmaPseudoMap][]
    >,
    ReadonlyPragmaMap {
  set<TKey extends keyof PragmaPseudoMap>(
    key: TKey,
    value: PragmaPseudoMap[TKey] | PragmaPseudoMap[TKey][]
  ): this;
  get<TKey extends keyof PragmaPseudoMap>(
    key: TKey
  ): PragmaPseudoMap[TKey] | PragmaPseudoMap[TKey][];
  forEach(
    action: <TKey extends keyof PragmaPseudoMap>(
      value: PragmaPseudoMap[TKey] | PragmaPseudoMap[TKey][],
      key: TKey
    ) => void
  ): void;
}

export type MutableNodeArray<T extends Node> = NodeArray<T> & T[];
