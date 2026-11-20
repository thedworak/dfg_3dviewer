// src/debug-build.ts
/**
* This serves as a build time flag that will be true by default, but false in non-debug builds or if users replace `__SENTRY_DEBUG__` in their generated code.
*
* ATTENTION: This constant must never cross package boundaries (i.e. be exported) to guarantee that it can be used for tree shaking.
*/
const DEBUG_BUILD$2 = typeof __SENTRY_DEBUG__ === "undefined" || __SENTRY_DEBUG__;

// src/utils/worldwide.ts
/** Get's the global object for the current JavaScript runtime */
const GLOBAL_OBJ = globalThis;

// src/utils/version.ts
const SDK_VERSION = "11.14.0";

// src/carrier.ts
/**
* Returns the global shim registry.
*
* FIXME: This function is problematic, because despite always returning a valid Carrier,
* it has an optional `__SENTRY__` property, which then in turn requires us to always perform an unnecessary check
* at the call-site. We always access the carrier through this function, so we can guarantee that `__SENTRY__` is there.
**/
function getMainCarrier() {
	getSentryCarrier(GLOBAL_OBJ);
	return GLOBAL_OBJ;
}
/** Will either get the existing sentry carrier, or create a new one. */
function getSentryCarrier(carrier) {
	const __SENTRY__ = carrier.__SENTRY__ = carrier.__SENTRY__ || {};
	__SENTRY__.version = __SENTRY__.version || "11.14.0";
	return __SENTRY__[SDK_VERSION] = __SENTRY__["11.14.0"] || {};
}
/**
* Returns a global singleton contained in the global `__SENTRY__[]` object.
*
* If the singleton doesn't already exist in `__SENTRY__`, it will be created using the given factory
* function and added to the `__SENTRY__` object.
*
* @param name name of the global singleton on __SENTRY__
* @param creator creator Factory function to create the singleton if it doesn't already exist on `__SENTRY__`
* @param obj (Optional) The global object on which to look for `__SENTRY__`, if not `GLOBAL_OBJ`'s return value
* @returns the singleton
*/
function getGlobalSingleton(name, creator, obj = GLOBAL_OBJ) {
	const __SENTRY__ = obj.__SENTRY__ = obj.__SENTRY__ || {};
	const carrier = __SENTRY__[SDK_VERSION] = __SENTRY__["11.14.0"] || {};
	return carrier[name] || (carrier[name] = creator());
}

// src/utils/debug-logger.ts
const CONSOLE_LEVELS = [
	"debug",
	"info",
	"warn",
	"error",
	"log",
	"assert",
	"trace"
];
/** Prefix for logging strings */
const PREFIX = "Sentry Logger ";
/** This may be mutated by the console instrumentation. */
const originalConsoleMethods = {};
/**
* Temporarily disable sentry console instrumentations.
*
* @param callback The function to run against the original `console` messages
* @returns The results of the callback
*/
function consoleSandbox(callback) {
	if (!("console" in GLOBAL_OBJ)) return callback();
	const console = GLOBAL_OBJ.console;
	const wrappedFuncs = {};
	const wrappedLevels = Object.keys(originalConsoleMethods);
	wrappedLevels.forEach((level) => {
		const originalConsoleMethod = originalConsoleMethods[level];
		wrappedFuncs[level] = console[level];
		console[level] = originalConsoleMethod;
	});
	try {
		return callback();
	} finally {
		wrappedLevels.forEach((level) => {
			console[level] = wrappedFuncs[level];
		});
	}
}
function enable() {
	_getLoggerSettings().enabled = true;
}
function disable() {
	_getLoggerSettings().enabled = false;
}
function isEnabled() {
	return _getLoggerSettings().enabled;
}
function log(...args) {
	_maybeLog("log", ...args);
}
function warn(...args) {
	_maybeLog("warn", ...args);
}
function error(...args) {
	_maybeLog("error", ...args);
}
function _maybeLog(level, ...args) {
	if (!DEBUG_BUILD$2) return;
	if (isEnabled()) consoleSandbox(() => {
		GLOBAL_OBJ.console[level](`${PREFIX}[${level}]:`, ...args);
	});
}
function _getLoggerSettings() {
	if (!DEBUG_BUILD$2) return { enabled: false };
	return getGlobalSingleton("loggerSettings", () => ({ enabled: false }));
}
/**
* This is a logger singleton which either logs things or no-ops if logging is not enabled.
*/
const debug = {
	/** Enable logging. */
	enable,
	/** Disable logging. */
	disable,
	/** Check if logging is enabled. */
	isEnabled,
	/** Log a message. */
	log,
	/** Log a warning. */
	warn,
	/** Log an error. */
	error
};

// src/utils/stacktrace.ts
const STACKTRACE_FRAME_LIMIT = 50;
const UNKNOWN_FUNCTION = "?";
const WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/;
const STRIP_FRAME_REGEXP = /captureMessage|captureException/;
/**
* Creates a stack parser with the supplied line parsers
*
* StackFrames are returned in the correct order for Sentry Exception
* frames and with Sentry SDK internal frames removed from the top and bottom
*
*/
function createStackParser(...parsers) {
	const sortedParsers = parsers.sort((a, b) => a[0] - b[0]).map((p) => p[1]);
	return (stack, skipFirstLines = 0, framesToPop = 0) => {
		const frames = [];
		const lines = stack.split("\n");
		for (let i = skipFirstLines; i < lines.length; i++) {
			let line = lines[i];
			if (line.length > 1024) line = line.slice(0, 1024);
			const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, "$1") : line;
			if (cleanedLine.includes("Error: ")) continue;
			for (const parser of sortedParsers) {
				const frame = parser(cleanedLine);
				if (frame) {
					frames.push(frame);
					break;
				}
			}
			if (frames.length >= STACKTRACE_FRAME_LIMIT + framesToPop) break;
		}
		return stripSentryFramesAndReverse(frames.slice(framesToPop));
	};
}
/**
* Gets a stack parser implementation from Options.stackParser
* @see Options
*
* If options contains an array of line parsers, it is converted into a parser
*/
function stackParserFromStackParserOptions(stackParser) {
	if (Array.isArray(stackParser)) return createStackParser(...stackParser);
	return stackParser;
}
/**
* Removes Sentry frames from the top and bottom of the stack if present and enforces a limit of max number of frames.
* Assumes stack input is ordered from top to bottom and returns the reverse representation so call site of the
* function that caused the crash is the last frame in the array.
* @hidden
*/
function stripSentryFramesAndReverse(stack) {
	if (!stack.length) return [];
	const localStack = Array.from(stack);
	if (/sentryWrapped/.test(getLastStackFrame(localStack).function || "")) localStack.pop();
	localStack.reverse();
	if (STRIP_FRAME_REGEXP.test(getLastStackFrame(localStack).function || "")) {
		localStack.pop();
		if (STRIP_FRAME_REGEXP.test(getLastStackFrame(localStack).function || "")) localStack.pop();
	}
	return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame) => ({
		...frame,
		filename: frame.filename || getLastStackFrame(localStack).filename,
		function: frame.function || "?"
	}));
}
function getLastStackFrame(arr) {
	return arr[arr.length - 1] || {};
}
const defaultFunctionName = "<anonymous>";
/**
* Safely extract function name from itself
*/
function getFunctionName(fn) {
	try {
		if (!fn || typeof fn !== "function") return defaultFunctionName;
		return fn.name || defaultFunctionName;
	} catch {
		return defaultFunctionName;
	}
}
/**
* Get's stack frames from an event without needing to check for undefined properties.
*/
function getFramesFromEvent(event) {
	const exception = event.exception;
	if (exception) {
		const frames = [];
		try {
			exception.values.forEach((value) => {
				if (value.stacktrace.frames) frames.push(...value.stacktrace.frames);
			});
			return frames;
		} catch {
			return;
		}
	}
}

// src/instrument/handlers.ts
const handlers = {};
const instrumented = {};
/** Add a handler function. Returns a function to remove the handler. */
function addHandler(type, handler) {
	handlers[type] = handlers[type] || [];
	handlers[type].push(handler);
	return () => {
		const typeHandlers = handlers[type];
		if (typeHandlers) {
			const index = typeHandlers.indexOf(handler);
			if (index !== -1) typeHandlers.splice(index, 1);
		}
	};
}
/** Maybe run an instrumentation function, unless it was already called. */
function maybeInstrument(type, instrumentFn) {
	if (!instrumented[type]) {
		instrumented[type] = true;
		try {
			instrumentFn();
		} catch (e) {
			DEBUG_BUILD$2 && debug.error(`Error while instrumenting ${type}`, e);
		}
	}
}
/** Trigger handlers for a given instrumentation type. */
function triggerHandlers(type, data) {
	const typeHandlers = type && handlers[type];
	if (!typeHandlers) return;
	for (const handler of typeHandlers) try {
		handler(data);
	} catch (e) {
		DEBUG_BUILD$2 && debug.error(`Error while triggering instrumentation handler.\nType: ${type}\nName: ${getFunctionName(handler)}\nError:`, e);
	}
}

// src/instrument/globalError.ts
let _oldOnErrorHandler = null;
/**
* Add an instrumentation handler for when an error is captured by the global error handler.
*
* Use at your own risk, this might break without changelog notice, only used internally.
* @hidden
*/
function addGlobalErrorInstrumentationHandler(handler) {
	const type = "error";
	addHandler(type, handler);
	maybeInstrument(type, instrumentError);
}
function instrumentError() {
	_oldOnErrorHandler = GLOBAL_OBJ.onerror;
	GLOBAL_OBJ.onerror = function(msg, url, line, column, error) {
		triggerHandlers("error", {
			column,
			error,
			line,
			msg,
			url
		});
		if (_oldOnErrorHandler) return _oldOnErrorHandler.apply(this, arguments);
		return false;
	};
	GLOBAL_OBJ.onerror.__SENTRY_INSTRUMENTED__ = true;
}

// src/instrument/globalUnhandledRejection.ts
let _oldOnUnhandledRejectionHandler = null;
/**
* Add an instrumentation handler for when an unhandled promise rejection is captured.
*
* Use at your own risk, this might break without changelog notice, only used internally.
* @hidden
*/
function addGlobalUnhandledRejectionInstrumentationHandler(handler) {
	const type = "unhandledrejection";
	addHandler(type, handler);
	maybeInstrument(type, instrumentUnhandledRejection);
}
function instrumentUnhandledRejection() {
	_oldOnUnhandledRejectionHandler = GLOBAL_OBJ.onunhandledrejection;
	GLOBAL_OBJ.onunhandledrejection = function(e) {
		triggerHandlers("unhandledrejection", e);
		if (_oldOnUnhandledRejectionHandler) return _oldOnUnhandledRejectionHandler.apply(this, arguments);
		return true;
	};
	GLOBAL_OBJ.onunhandledrejection.__SENTRY_INSTRUMENTED__ = true;
}

// src/utils/is.ts
const objectToString = Object.prototype.toString;
/**
* Checks whether given value's type is one of a few Error or Error-like
* {@link isError}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isError(wat) {
	switch (objectToString.call(wat)) {
		case "[object Error]":
		case "[object Exception]":
		case "[object DOMException]":
		case "[object WebAssembly.Exception]": return true;
		default: return isInstanceOf(wat, Error);
	}
}
/**
* Checks whether given value is an instance of the given built-in class.
*
* @param wat The value to be checked
* @param className
* @returns A boolean representing the result.
*/
function isBuiltin(wat, className) {
	return objectToString.call(wat) === `[object ${className}]`;
}
/**
* Checks whether given value's type is ErrorEvent
* {@link isErrorEvent}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isErrorEvent$1(wat) {
	return isBuiltin(wat, "ErrorEvent");
}
/**
* Checks whether given value's type is DOMError
* {@link isDOMError}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isDOMError(wat) {
	return isBuiltin(wat, "DOMError");
}
/**
* Checks whether given value's type is DOMException
* {@link isDOMException}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isDOMException(wat) {
	return isBuiltin(wat, "DOMException");
}
/**
* Checks whether given value's type is a string
* {@link isString}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isString(wat) {
	return isBuiltin(wat, "String");
}
/**
* Checks whether given string is parameterized
* {@link isParameterizedString}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isParameterizedString(wat) {
	return typeof wat === "object" && wat !== null && "__sentry_template_string__" in wat && "__sentry_template_values__" in wat;
}
/**
* Checks whether given value is a primitive (undefined, null, number, boolean, string, bigint, symbol)
* {@link isPrimitive}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isPrimitive(wat) {
	return wat === null || isParameterizedString(wat) || typeof wat !== "object" && typeof wat !== "function";
}
/**
* Checks whether given value's type is an object literal, or a class instance.
* {@link isPlainObject}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isPlainObject(wat) {
	return isBuiltin(wat, "Object");
}
/**
* Checks whether given value is a non-null object (i.e. `typeof` is `'object'` and it is not `null`).
* Unlike {@link isPlainObject}, this also accepts arrays and class instances - it only rules out
* `null`, primitives, and functions.
* {@link isObjectLike}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isObjectLike(wat) {
	return typeof wat === "object" && wat !== null;
}
/**
* Checks whether given value's type is an Event instance
* {@link isEvent}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isEvent(wat) {
	return typeof Event !== "undefined" && isInstanceOf(wat, Event);
}
/**
* Checks whether given value's type is an regexp
* {@link isRegExp}.
*
* @param wat A value to be checked.
* @returns A boolean representing the result.
*/
function isRegExp(wat) {
	return isBuiltin(wat, "RegExp");
}
/**
* Checks whether given value has a then function.
* @param wat A value to be checked.
*/
function isThenable(wat) {
	return Boolean(wat?.then && typeof wat.then === "function");
}
function isInstanceOf(wat, base) {
	try {
		return wat instanceof base;
	} catch {
		return false;
	}
}
/**
* Checks whether the given parameter is a Standard Web API Request instance.
*
* Returns false if Request is not available in the current runtime.
*/
function isRequest(request) {
	return typeof Request !== "undefined" && isInstanceOf(request, Request);
}

// src/utils/object.ts
/**
* Replace a method in an object with a wrapped version of itself.
*
* If the method on the passed object is not a function, the wrapper will not be applied.
*
* @param source An object that contains a method to be wrapped.
* @param name The name of the method to be wrapped.
* @param replacementFactory A higher-order function that takes the original version of the given method and returns a
* wrapped version. Note: The function returned by `replacementFactory` needs to be a non-arrow function, in order to
* preserve the correct value of `this`, and the original method must be called using `origMethod.call(this, <other
* args>)` or `origMethod.apply(this, [<other args>])` (rather than being called directly), again to preserve `this`.
* @returns void
*/
function fill(source, name, replacementFactory) {
	if (!(name in source)) return;
	const original = source[name];
	if (typeof original !== "function") return;
	const wrapped = replacementFactory(original);
	if (typeof wrapped === "function") markFunctionWrapped(wrapped, original);
	try {
		source[name] = wrapped;
	} catch {
		DEBUG_BUILD$2 && debug.log(`Failed to replace method "${String(name)}" in object`, source);
	}
}
/**
* Defines a non-enumerable property on the given object.
*
* @param obj The object on which to set the property
* @param name The name of the property to be set
* @param value The value to which to set the property
*/
function addNonEnumerableProperty(obj, name, value) {
	try {
		Object.defineProperty(obj, name, {
			value,
			writable: true,
			configurable: true
		});
	} catch {
		DEBUG_BUILD$2 && debug.log(`Failed to add non-enumerable property "${String(name)}" to object`, obj);
	}
}
/**
* Remembers the original function on the wrapped function and
* patches up the prototype.
*
* @param wrapped the wrapper function
* @param original the original function that gets wrapped
*/
function markFunctionWrapped(wrapped, original) {
	try {
		wrapped.prototype = original.prototype = original.prototype || {};
		addNonEnumerableProperty(wrapped, "__sentry_original__", original);
	} catch {}
}
/**
* This extracts the original function if available.  See
* `markFunctionWrapped` for more information.
*
* @param func the function to unwrap
* @returns the unwrapped version of the function if available.
*/
function getOriginalFunction(func) {
	return func.__sentry_original__;
}
/**
* Transforms any `Error` or `Event` into a plain object with all of their enumerable properties, and some of their
* non-enumerable properties attached.
*
* @param value Initial source that we have to transform in order for it to be usable by the serializer
* @returns An Event or Error turned into an object - or the value argument itself, when value is neither an Event nor
*  an Error.
*/
function convertToPlainObject(value) {
	if (isError(value)) return {
		message: value.message,
		name: value.name,
		stack: value.stack,
		...getOwnProperties(value)
	};
	if (isEvent(value)) {
		const { type, target, currentTarget, detail } = value;
		return {
			type,
			target,
			currentTarget,
			...detail ? { detail } : {},
			...getOwnProperties(value)
		};
	}
	return value;
}
/** Filters out all but an object's own properties */
function getOwnProperties(obj) {
	if (isObjectLike(obj)) return Object.fromEntries(Object.entries(obj));
	return {};
}
/**
* Given any captured exception, extract its keys and create a sorted
* and truncated list that will be used inside the event message.
* eg. `Non-error exception captured with keys: foo, bar, baz`
*/
function extractExceptionKeysForMessage(exception) {
	const keys = Object.keys(convertToPlainObject(exception));
	keys.sort();
	return !keys[0] ? "[object has no keys]" : keys.join(", ");
}

// src/utils/randomSafeContext.ts
let RESOLVED_RUNNER;
/**
* Simple wrapper that allows SDKs to *secretly* set context wrapper to generate safe random IDs in cache components contexts
*/
function withRandomSafeContext(cb) {
	if (RESOLVED_RUNNER !== void 0) return RESOLVED_RUNNER ? RESOLVED_RUNNER(cb) : cb();
	const sym = Symbol.for("__SENTRY_SAFE_RANDOM_ID_WRAPPER__");
	const globalWithSymbol = GLOBAL_OBJ;
	if (sym in globalWithSymbol && typeof globalWithSymbol[sym] === "function") {
		RESOLVED_RUNNER = globalWithSymbol[sym];
		return RESOLVED_RUNNER(cb);
	}
	RESOLVED_RUNNER = null;
	return cb();
}
/**
* Identical to Math.random() but wrapped in withRandomSafeContext
* to ensure safe random number generation in certain contexts (e.g., Next.js Cache Components).
*/
function safeMathRandom() {
	return withRandomSafeContext(() => Math.random());
}
/**
* Identical to Date.now() but wrapped in withRandomSafeContext
* to ensure safe time value generation in certain contexts (e.g., Next.js Cache Components).
*/
function safeDateNow() {
	return withRandomSafeContext(() => Date.now());
}

// src/utils/normalizationHints.ts
/**
* Internal symbols for normalization behavior. JSON and other structured user payloads cannot
* carry these keys, so they cannot spoof SDK-only normalization hints.
* We use Symbol.for to ensure that the symbols are the same across different modules/files.
*/
const SENTRY_SKIP_NORMALIZATION = Symbol.for("sentry.skipNormalization");
const SENTRY_OVERRIDE_NORMALIZATION_DEPTH = Symbol.for("sentry.overrideNormalizationDepth");
/** @internal */
function hasSkipNormalizationHint(value) {
	return Boolean(value[SENTRY_SKIP_NORMALIZATION]);
}
/** @internal */
function getNormalizationDepthOverrideHint(value) {
	const v = value[SENTRY_OVERRIDE_NORMALIZATION_DEPTH];
	return typeof v === "number" ? v : void 0;
}

// src/utils/normalize.ts
let stringifier;
/**
* Set a custom stringifier for the normalize function.
* If this returns a non-empty string, it will be used instead of the default stringification.
* Return undefined to fall back to the generic behavior.
*/
function setNormalizeStringifier(newStringifier) {
	stringifier = newStringifier;
}
/**
* Recursively normalizes the given object.
*
* - Creates a copy to prevent original input mutation
* - Skips non-enumerable properties
* - When stringifying, calls `toJSON` if implemented
* - Removes circular references
* - Translates non-serializable values (`undefined`/`NaN`/functions) to serializable format
* - Translates known global objects/classes to a string representations
* - Takes care of `Error` object serialization
* - Optionally limits depth of final output
* - Optionally limits number of properties/elements included in any single object/array
*
* @param input The object to be normalized.
* @param depth The max depth to which to normalize the object. (Anything deeper stringified whole.)
* @param maxProperties The max number of elements or properties to be included in any single array or
* object in the normalized output.
* @returns A normalized version of the object, or `"**non-serializable**"` if any errors are thrown during normalization.
*/
function normalize(input, depth = 100, maxProperties = 1e400) {
	try {
		return visit("", input, depth, maxProperties);
	} catch (err) {
		return { ERROR: `**non-serializable** (${stringifyCaughtValue(err)})` };
	}
}
/**
* Stringify a caught value for an error message. Template literals and other implicit
* conversions throw on symbols and on objects with no usable `toString`, which is how
* the values that end up here tend to be broken in the first place, so fall back to
* fixed text instead of throwing again.
*/
function stringifyCaughtValue(err) {
	try {
		return String(err);
	} catch {
		return "unknown error";
	}
}
/** JSDoc */
function normalizeToSize(object, depth = 3, maxSize = 102400) {
	const normalized = normalize(object, depth);
	if (jsonSize(normalized) > maxSize) return normalizeToSize(object, depth - 1, maxSize);
	return normalized;
}
/**
* Visits a node to perform normalization on it
*
* @param key The key corresponding to the given node
* @param value The node to be visited
* @param depth Optional number indicating the maximum recursion depth
* @param maxProperties Optional maximum number of properties/elements included in any single object/array
* @param memo Optional Memo class handling decycling
*/
function visit(key, value, depth = 1e400, maxProperties = 1e400, memo = memoBuilder()) {
	const [memoize, unmemoize] = memo;
	if (value == null || ["boolean", "string"].includes(typeof value) || typeof value === "number" && Number.isFinite(value)) return value;
	const stringified = stringifyValue(key, value);
	if (!stringified.startsWith("[object ")) return stringified;
	if (hasSkipNormalizationHint(value)) return value;
	const overrideDepth = getNormalizationDepthOverrideHint(value);
	const remainingDepth = overrideDepth !== void 0 ? overrideDepth : depth;
	if (remainingDepth === 0) return stringified.replace("object ", "");
	if (memoize(value)) return "[Circular ~]";
	const valueWithToJSON = value;
	if (valueWithToJSON && typeof valueWithToJSON.toJSON === "function") try {
		return visit("", valueWithToJSON.toJSON(), remainingDepth - 1, maxProperties, memo);
	} catch {}
	const normalized = Array.isArray(value) ? [] : {};
	let numAdded = 0;
	const visitable = convertToPlainObject(value);
	for (const visitKey in visitable) {
		if (!Object.prototype.hasOwnProperty.call(visitable, visitKey)) continue;
		if (numAdded >= maxProperties) {
			normalized[visitKey] = "[MaxProperties ~]";
			break;
		}
		const visitValue = visitable[visitKey];
		normalized[visitKey] = visit(visitKey, visitValue, remainingDepth - 1, maxProperties, memo);
		numAdded++;
	}
	unmemoize(value);
	return normalized;
}
/**
* Stringify the given value. Handles various known special values and types.
*
* Not meant to be used on simple primitives which already have a string representation, as it will, for example, turn
* the number 1231 into "[Object Number]", nor on `null`, as it will throw.
*
* @param value The value to stringify
* @returns A stringified representation of the given value
*/
function stringifyValue(key, value) {
	try {
		if (stringifier) {
			const stringified = stringifier(value);
			if (stringified) return stringified;
		}
		if (typeof global !== "undefined" && value === global) return "[Global]";
		if (typeof value === "number" && !Number.isFinite(value)) return `[${value}]`;
		if (typeof value === "function") return `[Function: ${getFunctionName(value)}]`;
		if (typeof value === "symbol") return `[${String(value)}]`;
		if (typeof value === "bigint") return `[BigInt: ${String(value)}]`;
		return `[object ${getConstructorName$1(value)}]`;
	} catch (err) {
		return `**non-serializable** (${stringifyCaughtValue(err)})`;
	}
}
function getConstructorName$1(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype?.constructor ? prototype.constructor.name : "null prototype";
}
/** Calculates bytes size of input string */
function utf8Length(value) {
	return ~-encodeURI(value).split(/%..|./).length;
}
/** Calculates bytes size of input object */
function jsonSize(value) {
	return utf8Length(JSON.stringify(value));
}
/**
* Helper to decycle json objects
*/
function memoBuilder() {
	const inner = /* @__PURE__ */ new WeakSet();
	function memoize(obj) {
		if (inner.has(obj)) return true;
		inner.add(obj);
		return false;
	}
	function unmemoize(obj) {
		inner.delete(obj);
	}
	return [memoize, unmemoize];
}

// src/utils/string.ts
/**
* Coerce a value to a string without ever throwing. Strings pass through unchanged (so an
* already-serialized value isn't double-encoded and a plain string isn't wrapped in quotes);
* anything else is `JSON.stringify`-ed, falling back to `fallback` if that throws (e.g. on
* circular references or `BigInt`). Returns `undefined` for values `JSON.stringify` itself drops
* (top-level `undefined`, functions, symbols), matching `JSON.stringify`'s own runtime behavior.
*
* @param value the value to stringify
* @param fallback returned when serialization throws, or, if a function, called with `value` to
*   produce the fallback. Defaults to `'[unserializable]'`.
*/
function stringify(value, fallback = "[unserializable]") {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value);
	} catch {
		return typeof fallback === "function" ? fallback(value) : fallback;
	}
}
/**
* Truncates given string to the maximum characters count
*
* @param str An object that contains serializable values
* @param max Maximum number of characters in truncated string (0 = unlimited)
* @returns string Encoded
*/
function truncate(str, max = 0) {
	if (typeof str !== "string" || max === 0) return str;
	return str.length <= max ? str : `${str.slice(0, max)}...`;
}
/**
* Join values in array
* @param input array of values to be joined together
* @param delimiter string to be placed in-between values
* @returns Joined values
*/
function safeJoin(input, delimiter) {
	if (!Array.isArray(input)) return "";
	const output = [];
	for (let i = 0; i < input.length; i++) {
		const value = input[i];
		if (isPrimitive(value)) output.push(String(value));
		else if (value instanceof Error) output.push(value.message ? `${value.name}: ${value.message}` : value.name);
		else output.push(stringifyValue(void 0, value));
	}
	return output.join(delimiter);
}
/**
* Checks if the given value matches a regex or string
*
* @param value The string to test
* @param pattern Either a regex or a string against which `value` will be matched
* @param requireExactStringMatch If true, `value` must match `pattern` exactly. If false, `value` will match
* `pattern` if it contains `pattern`. Only applies to string-type patterns.
*/
function isMatchingPattern(value, pattern, requireExactStringMatch = false) {
	if (!isString(value)) return false;
	if (isRegExp(pattern)) return pattern.test(value);
	if (isString(pattern)) return requireExactStringMatch ? value === pattern : value.includes(pattern);
	if (typeof pattern === "function") return pattern(value);
	return false;
}
/**
* Test the given string against an array of strings and regexes. By default, string matching is done on a
* substring-inclusion basis rather than a strict equality basis
*
* @param testString The string to test
* @param patterns The patterns against which to test the string
* @param requireExactStringMatch If true, `testString` must match one of the given string patterns exactly in order to
* count. If false, `testString` will match a string pattern if it contains that pattern.
* @returns
*/
function stringMatchesSomePattern(testString, patterns = [], requireExactStringMatch = false) {
	for (const pattern of patterns) if (isMatchingPattern(testString, pattern, requireExactStringMatch)) return true;
	return false;
}

// src/utils/misc.ts
function getCrypto() {
	const gbl = GLOBAL_OBJ;
	return gbl.crypto || gbl.msCrypto;
}
let emptyUuid;
function getRandomByte() {
	return safeMathRandom() * 16;
}
/**
* UUID4 generator
* @param crypto Object that provides the crypto API.
* @returns string Generated UUID4.
*/
function uuid4(crypto = getCrypto()) {
	try {
		if (crypto?.randomUUID) return withRandomSafeContext(() => crypto.randomUUID()).replace(/-/g, "");
	} catch {}
	if (!emptyUuid) emptyUuid = "10000000100040008000100000000000";
	return emptyUuid.replace(/[018]/g, (c) => (c ^ (getRandomByte() & 15) >> c / 4).toString(16));
}
function getFirstException(event) {
	return event.exception?.values?.[0];
}
/**
* Extracts either message or type+value from an event that can be used for user-facing logs
* @returns event's description
*/
function getEventDescription(event) {
	const { message, event_id: eventId } = event;
	if (message) return message;
	const firstException = getFirstException(event);
	if (firstException) {
		if (firstException.type && firstException.value) return `${firstException.type}: ${firstException.value}`;
		return firstException.type || firstException.value || eventId || "<unknown>";
	}
	return eventId || "<unknown>";
}
/**
* Adds exception values, type and value to an synthetic Exception.
* @param event The event to modify.
* @param value Value of the exception.
* @param type Type of the exception.
* @hidden
*/
function addExceptionTypeValue(event, value, type) {
	const exception = event.exception = event.exception || {};
	const values = exception.values = exception.values || [];
	const firstException = values[0] = values[0] || {};
	if (!firstException.value) firstException.value = value || "";
	if (!firstException.type) firstException.type = "Error";
}
/**
* Adds exception mechanism data to a given event. Uses defaults if the second parameter is not passed.
*
* @param event The event to modify.
* @param newMechanism Mechanism data to add to the event.
* @hidden
*/
function addExceptionMechanism(event, newMechanism) {
	const firstException = getFirstException(event);
	if (!firstException) return;
	applyExceptionMechanism(firstException, newMechanism);
}
/**
* Adds exception mechanism data to the originally captured (root) exception of a given event.
*
* @hidden
*/
function addExceptionMechanismToCapturedException(event, newMechanism) {
	const exceptions = event.exception?.values;
	const capturedException = exceptions?.find((exception) => exception.mechanism?.exception_id === 0) ?? exceptions?.[0];
	if (!capturedException) return;
	applyExceptionMechanism(capturedException, newMechanism);
}
function applyExceptionMechanism(exception, newMechanism) {
	const defaultMechanism = {
		type: "generic",
		handled: true
	};
	const currentMechanism = exception.mechanism;
	exception.mechanism = {
		...defaultMechanism,
		...currentMechanism,
		...newMechanism
	};
	if (newMechanism && "data" in newMechanism) exception.mechanism.data = {
		...currentMechanism?.data,
		...newMechanism.data
	};
}
/**
* Checks whether or not we've already captured the given exception (note: not an identical exception - the very object
* in question), and marks it captured if not.
*
* This is useful because it's possible for an error to get captured by more than one mechanism. After we intercept and
* record an error, we rethrow it (assuming we've intercepted it before it's reached the top-level global handlers), so
* that we don't interfere with whatever effects the error might have had were the SDK not there. At that point, because
* the error has been rethrown, it's possible for it to bubble up to some other code we've instrumented. If it's not
* caught after that, it will bubble all the way up to the global handlers (which of course we also instrument). This
* function helps us ensure that even if we encounter the same error more than once, we only record it the first time we
* see it.
*
* The client runs this check for every captured exception, also when `dedupeIntegration` is not active.
* `dedupeIntegration` drops equal events that come from different error objects.
*
* Note: It will ignore primitives (always return `false` and not mark them as seen), as properties can't be set on
* them. {@link: Object.objectify} can be used on exceptions to convert any that are primitives into their equivalent
* object wrapper forms so that this check will always work. However, because we need to flag the exact object which
* will get rethrown, and because that rethrowing happens outside of the event processing pipeline, the objectification
* must be done before the exception captured.
*
* @param A thrown exception to check or flag as having been seen
* @returns `true` if the exception has already been captured, `false` if not (with the side effect of marking it seen)
*/
function checkOrSetAlreadyCaught(exception) {
	if (isAlreadyCaptured(exception)) return true;
	try {
		addNonEnumerableProperty(exception, "__sentry_captured__", true);
	} catch {}
	return false;
}
/**
* Checks whether we've already captured the given exception (note: not an identical exception - the very object).
* It is considered already captured if it has the `__sentry_captured__` property set to `true`.
*
* @internal Only considered for internal usage
*/
function isAlreadyCaptured(exception) {
	try {
		return exception.__sentry_captured__;
	} catch {}
}

// src/utils/time.ts
const ONE_SECOND_IN_MS = 1e3;
/**
* If `performance.timeOrigin + performance.now()` and `Date.now()` differ by more than this, we correct the time origin.
*/
const CLOCK_DRIFT_THRESHOLD_MS = 1e3;
/**
* Max number of time origins we store. When we hit it, we drop the oldest one, except the page load origin, which
* the pageload span uses.
*/
const MAX_TIME_ORIGIN_SEGMENTS = 100;
/**
* Returns a timestamp in seconds since the UNIX epoch using the Date API.
*/
function dateTimestampInSeconds() {
	return safeDateNow() / ONE_SECOND_IN_MS;
}
/**
* All time origins of the page, oldest first. Empty until the first `timestampInSeconds` call, or if the Performance
* API is unavailable.
*/
let _timeOriginSegments = [];
/**
* Returns a wrapper around the native Performance API browser implementation, or undefined for browsers that do not
* support the API.
*
* Wrapping the native API works around differences in behavior from different browsers.
*/
function createUnixTimestampInSecondsFunc() {
	const { performance } = GLOBAL_OBJ;
	if (!performance?.now || !performance.timeOrigin) {
		if (performance?.now) _timeOriginSegments = [{
			from: 0,
			origin: safeDateNow() - withRandomSafeContext(() => performance.now())
		}];
		return dateTimestampInSeconds;
	}
	let correctedTimeOrigin = performance.timeOrigin;
	_timeOriginSegments = [{
		from: 0,
		origin: correctedTimeOrigin
	}];
	let isFirstCall = true;
	let lastCheckedPerformanceNow = 0;
	return () => {
		return withRandomSafeContext(() => {
			const performanceNow = performance.now();
			const dateNow = Date.now();
			if (Math.abs(correctedTimeOrigin + performanceNow - dateNow) > CLOCK_DRIFT_THRESHOLD_MS) {
				correctedTimeOrigin = dateNow - performanceNow;
				if (isFirstCall) _timeOriginSegments = [{
					from: 0,
					origin: correctedTimeOrigin
				}];
				else {
					_timeOriginSegments.push({
						from: lastCheckedPerformanceNow,
						origin: correctedTimeOrigin
					});
					if (_timeOriginSegments.length > MAX_TIME_ORIGIN_SEGMENTS) _timeOriginSegments.splice(1, 1);
				}
			}
			isFirstCall = false;
			lastCheckedPerformanceNow = performanceNow;
			return (correctedTimeOrigin + performanceNow) / ONE_SECOND_IN_MS;
		});
	};
}
let _cachedTimestampInSecondsFn;
/**
* Returns a timestamp in seconds since the UNIX epoch using either the Performance or Date APIs, depending on the
* availability of the Performance API.
*
* If the Performance API time and `Date.now()` differ by more than {@link CLOCK_DRIFT_THRESHOLD_MS} (e.g. after the
* device slept), the time origin is corrected based on `Date.now()`.
* See https://github.com/getsentry/sentry-javascript/issues/2590.
*/
function timestampInSeconds() {
	return (_cachedTimestampInSecondsFn ?? (_cachedTimestampInSecondsFn = createUnixTimestampInSecondsFunc()))();
}

// src/session.ts
/**
* Creates a new `Session` object by setting certain default parameters. If optional @param context
* is passed, the passed properties are applied to the session object.
*
* @param context (optional) additional properties to be applied to the returned session object
*
* @returns a new `Session` object
*/
function makeSession(context) {
	const startingTime = timestampInSeconds();
	const session = {
		sid: uuid4(),
		init: true,
		timestamp: startingTime,
		started: startingTime,
		duration: 0,
		status: "ok",
		errors: 0,
		ignoreDuration: false,
		toJSON: () => sessionToJSON(session)
	};
	if (context) updateSession(session, context);
	return session;
}
/**
* Updates a session object with the properties passed in the context.
*
* Note that this function mutates the passed object and returns void.
* (Had to do this instead of returning a new and updated session because closing and sending a session
* makes an update to the session after it was passed to the sending logic.
* @see Client.captureSession )
*
* @param session the `Session` to update
* @param context the `SessionContext` holding the properties that should be updated in @param session
*/
function updateSession(session, context = {}) {
	if (context.user) {
		if (!session.ipAddress && context.user.ip_address) session.ipAddress = context.user.ip_address;
		if (!session.did && !context.did) session.did = context.user.id || context.user.email || context.user.username;
	}
	session.timestamp = context.timestamp || timestampInSeconds();
	if (context.abnormal_mechanism) session.abnormal_mechanism = context.abnormal_mechanism;
	if (context.ignoreDuration) session.ignoreDuration = context.ignoreDuration;
	if (context.sid) session.sid = context.sid.length === 32 ? context.sid : uuid4();
	if (context.init !== void 0) session.init = context.init;
	if (!session.did && context.did) session.did = `${context.did}`;
	if (typeof context.started === "number") session.started = context.started;
	if (session.ignoreDuration) session.duration = void 0;
	else if (typeof context.duration === "number") session.duration = context.duration;
	else {
		const duration = session.timestamp - session.started;
		session.duration = duration >= 0 ? duration : 0;
	}
	if (context.release) session.release = context.release;
	if (context.environment) session.environment = context.environment;
	if (!session.ipAddress && context.ipAddress) session.ipAddress = context.ipAddress;
	if (!session.userAgent && context.userAgent) session.userAgent = context.userAgent;
	if (typeof context.errors === "number") session.errors = context.errors;
	if (context.status) session.status = context.status;
}
/**
* Closes a session by setting its status and updating the session object with it.
* Internally calls `updateSession` to update the passed session object.
*
* Note that this function mutates the passed session (@see updateSession for explanation).
*
* @param session the `Session` object to be closed
* @param status the `SessionStatus` with which the session was closed. If you don't pass a status,
*               this function will keep the previously set status, unless it was `'ok'` in which case
*               it is changed to `'exited'`.
*/
function closeSession(session, status) {
	let context = {};
	if (session.status === "ok") context = { status: "exited" };
	updateSession(session, context);
}
/**
* Serializes a passed session object to a JSON object with a slightly different structure.
* This is necessary because the Sentry backend requires a slightly different schema of a session
* than the one the JS SDKs use internally.
*
* @param session the session to be converted
*
* @returns a JSON object of the passed session
*/
function sessionToJSON(session) {
	return {
		sid: `${session.sid}`,
		init: session.init,
		started: (/* @__PURE__ */ new Date(session.started * 1e3)).toISOString(),
		timestamp: (/* @__PURE__ */ new Date(session.timestamp * 1e3)).toISOString(),
		status: session.status,
		errors: session.errors,
		did: typeof session.did === "number" || typeof session.did === "string" ? `${session.did}` : void 0,
		duration: session.duration,
		abnormal_mechanism: session.abnormal_mechanism,
		attrs: {
			release: session.release,
			environment: session.environment,
			ip_address: session.ipAddress,
			user_agent: session.userAgent
		}
	};
}

// src/utils/merge.ts
/**
* Shallow merge two objects.
* Does not mutate the passed in objects.
* Undefined/empty values in the merge object will overwrite existing values.
*
* By default, this merges 2 levels deep.
*/
function merge(initialObj, mergeObj, levels = 2) {
	if (!mergeObj || typeof mergeObj !== "object" || levels <= 0) return mergeObj;
	if (initialObj && Object.keys(mergeObj).length === 0) return initialObj;
	const output = { ...initialObj };
	for (const key in mergeObj) if (Object.prototype.hasOwnProperty.call(mergeObj, key)) output[key] = merge(output[key], mergeObj[key], levels - 1);
	return output;
}

// src/utils/propagationContext.ts
/**
* Generate a random, valid trace ID.
*/
function generateTraceId() {
	return uuid4();
}
/**
* Generate a random, valid span ID.
*/
function generateSpanId() {
	return uuid4().substring(16);
}

// src/scope.ts
/**
* Default value for maximum number of breadcrumbs added to an event.
*/
const DEFAULT_MAX_BREADCRUMBS = 100;
/**
* Holds additional event information.
*/
var Scope = class Scope {
	constructor() {
		this._notifyingListeners = false;
		this._scopeListeners = [];
		this._eventProcessors = [];
		this._breadcrumbs = [];
		this._attachments = [];
		this._user = {};
		this._tags = {};
		this._attributes = {};
		this._extra = {};
		this._contexts = {};
		this._sdkProcessingMetadata = {};
		addNonEnumerableProperty(this, "refs", {});
		this._propagationContext = {
			traceId: generateTraceId(),
			sampleRand: safeMathRandom()
		};
	}
	/**
	* Clone all data from this scope into a new scope.
	*/
	clone() {
		const newScope = new Scope();
		newScope._breadcrumbs = [...this._breadcrumbs];
		newScope._tags = { ...this._tags };
		newScope._attributes = { ...this._attributes };
		newScope._extra = { ...this._extra };
		newScope._contexts = { ...this._contexts };
		if (this._contexts.flags) newScope._contexts.flags = { values: [...this._contexts.flags.values] };
		newScope._user = this._user;
		newScope._level = this._level;
		newScope._session = this._session;
		newScope._transactionName = this._transactionName;
		newScope._fingerprint = this._fingerprint;
		newScope._eventProcessors = [...this._eventProcessors];
		newScope._attachments = [...this._attachments];
		newScope._sdkProcessingMetadata = { ...this._sdkProcessingMetadata };
		newScope._propagationContext = { ...this._propagationContext };
		newScope._client = this._client;
		newScope._lastEventId = this._lastEventId;
		newScope._conversationId = this._conversationId;
		newScope.refs = { ...this.refs };
		return newScope;
	}
	/**
	* Update the client assigned to this scope.
	* Note that not every scope will have a client assigned - isolation scopes & the global scope will generally not have a client,
	* as well as manually created scopes.
	*/
	setClient(client) {
		this._client = client;
	}
	/**
	* Set the ID of the last captured error event.
	* This is generally only captured on the isolation scope.
	*/
	setLastEventId(lastEventId) {
		this._lastEventId = lastEventId;
	}
	/**
	* Get the client assigned to this scope.
	*/
	getClient() {
		return this._client;
	}
	/**
	* Get the ID of the last captured error event.
	* This is generally only available on the isolation scope.
	*/
	lastEventId() {
		return this._lastEventId;
	}
	/**
	* @inheritDoc
	*/
	addScopeListener(callback) {
		this._scopeListeners.push(callback);
	}
	/**
	* Add an event processor that will be called before an event is sent.
	*/
	addEventProcessor(callback) {
		this._eventProcessors.push(callback);
		return this;
	}
	/**
	* Set the user for this scope.
	* Set to `null` to unset the user.
	*/
	setUser(user) {
		this._user = user || {
			email: void 0,
			id: void 0,
			ip_address: void 0,
			username: void 0
		};
		if (this._session) updateSession(this._session, { user });
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Get the user from this scope.
	*/
	getUser() {
		return this._user;
	}
	/**
	* Set the conversation ID for this scope.
	* Set to `null` to unset the conversation ID.
	*/
	setConversationId(conversationId) {
		this._conversationId = conversationId || void 0;
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Set an object that will be merged into existing tags on the scope,
	* and will be sent as tags data with the event.
	*/
	setTags(tags) {
		this._tags = {
			...this._tags,
			...tags
		};
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Set a single tag that will be sent as tags data with the event.
	*/
	setTag(key, value) {
		return this.setTags({ [key]: value });
	}
	/**
	* Sets attributes onto the scope.
	*
	* These attributes are applied to logs, metrics and streamed spans.
	*
	* Supported attribute value types are `string`, `number`, `boolean`, `string[]`, `number[]` and `boolean[]`.
	*
	* @param newAttributes - The attributes to set on the scope, as key-value pairs.
	*
	* @example
	* ```typescript
	* scope.setAttributes({
	*   is_admin: true,
	*   payment_selection: 'credit_card',
	*   render_duration: 150,
	* });
	* ```
	*/
	setAttributes(newAttributes) {
		this._attributes = {
			...this._attributes,
			...newAttributes
		};
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Sets an attribute onto the scope.
	*
	* These attributes are applied to logs, metrics and streamed spans.
	*
	* Supported attribute value types are `string`, `number`, `boolean`, `string[]`, `number[]` and `boolean[]`.
	*
	* @param key - The attribute key.
	* @param value - The attribute value.
	*
	* @example
	* ```typescript
	* scope.setAttribute('is_admin', true);
	* scope.setAttribute('render_duration', 150);
	* ```
	*/
	setAttribute(key, value) {
		return this.setAttributes({ [key]: value });
	}
	/**
	* Removes the attribute with the given key from the scope.
	*
	* @param key - The attribute key.
	*
	* @example
	* ```typescript
	* scope.removeAttribute('is_admin');
	* ```
	*/
	removeAttribute(key) {
		if (key in this._attributes) {
			delete this._attributes[key];
			this._notifyScopeListeners();
		}
		return this;
	}
	/**
	* Set an object that will be merged into existing extra on the scope,
	* and will be sent as extra data with the event.
	*/
	setExtras(extras) {
		this._extra = {
			...this._extra,
			...extras
		};
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Set a single key:value extra entry that will be sent as extra data with the event.
	*/
	setExtra(key, extra) {
		this._extra = {
			...this._extra,
			[key]: extra
		};
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Sets the fingerprint on the scope to send with the events.
	* @param {string[]} fingerprint Fingerprint to group events in Sentry.
	*/
	setFingerprint(fingerprint) {
		this._fingerprint = fingerprint;
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Sets the level on the scope for future events.
	*/
	setLevel(level) {
		this._level = level;
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Sets the transaction name on the scope so that the name of e.g. taken server route or
	* the page location is attached to future events.
	*
	* IMPORTANT: Calling this function does NOT change the name of the currently active
	* root span. If you want to change the name of the active root span, use
	* `Sentry.updateSpanName(rootSpan, 'new name')` instead.
	*
	* By default, the SDK updates the scope's transaction name automatically on sensible
	* occasions, such as a page navigation or when handling a new request on the server.
	*/
	setTransactionName(name) {
		this._transactionName = name;
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Sets context data with the given name.
	* Data passed as context will be normalized. You can also pass `null` to unset the context.
	* Note that context data will not be merged - calling `setContext` will overwrite an existing context with the same key.
	*/
	setContext(key, context) {
		if (context === null) delete this._contexts[key];
		else this._contexts[key] = context;
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Set the session for the scope.
	*/
	setSession(session) {
		if (!session) delete this._session;
		else this._session = session;
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Get the session from the scope.
	*/
	getSession() {
		return this._session;
	}
	/**
	* Updates the scope with provided data. Can work in three variations:
	* - plain object containing updatable attributes
	* - Scope instance that'll extract the attributes from
	* - callback function that'll receive the current scope as an argument and allow for modifications
	*/
	update(captureContext) {
		if (!captureContext) return this;
		const scopeToMerge = typeof captureContext === "function" ? captureContext(this) : captureContext;
		const { tags, attributes, extra, user, contexts, level, fingerprint = [], propagationContext, conversationId } = (scopeToMerge instanceof Scope ? scopeToMerge.getScopeData() : isPlainObject(scopeToMerge) ? captureContext : void 0) || {};
		this._tags = {
			...this._tags,
			...tags
		};
		this._attributes = {
			...this._attributes,
			...attributes
		};
		this._extra = {
			...this._extra,
			...extra
		};
		this._contexts = {
			...this._contexts,
			...contexts
		};
		if (user && Object.keys(user).length) this._user = user;
		if (level) this._level = level;
		if (fingerprint.length) this._fingerprint = fingerprint;
		if (propagationContext) this._propagationContext = propagationContext;
		if (conversationId) this._conversationId = conversationId;
		return this;
	}
	/**
	* Adds a breadcrumb to the scope.
	* By default, the last 100 breadcrumbs are kept.
	*/
	addBreadcrumb(breadcrumb, maxBreadcrumbs) {
		const maxCrumbs = typeof maxBreadcrumbs === "number" ? maxBreadcrumbs : DEFAULT_MAX_BREADCRUMBS;
		if (maxCrumbs <= 0) return this;
		const mergedBreadcrumb = {
			timestamp: dateTimestampInSeconds(),
			...breadcrumb,
			message: breadcrumb.message ? truncate(breadcrumb.message, 2048) : breadcrumb.message
		};
		this._breadcrumbs.push(mergedBreadcrumb);
		if (this._breadcrumbs.length > maxCrumbs) this._breadcrumbs = this._breadcrumbs.slice(-maxCrumbs);
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Get the last breadcrumb of the scope.
	*/
	getLastBreadcrumb() {
		return this._breadcrumbs[this._breadcrumbs.length - 1];
	}
	/**
	* Clear all breadcrumbs from the scope.
	*/
	clearBreadcrumbs() {
		this._breadcrumbs = [];
		this._notifyScopeListeners();
		return this;
	}
	/**
	* Add an attachment to the scope.
	*/
	addAttachment(attachment) {
		this._attachments.push(attachment);
		return this;
	}
	/**
	* Clear all attachments from the scope.
	*/
	clearAttachments() {
		this._attachments = [];
		return this;
	}
	/**
	* Get the data of this scope, which should be applied to an event during processing.
	*/
	getScopeData() {
		return {
			breadcrumbs: this._breadcrumbs,
			attachments: this._attachments,
			contexts: this._contexts,
			tags: this._tags,
			attributes: this._attributes,
			extra: this._extra,
			user: this._user,
			level: this._level,
			fingerprint: this._fingerprint || [],
			eventProcessors: this._eventProcessors,
			propagationContext: this._propagationContext,
			sdkProcessingMetadata: this._sdkProcessingMetadata,
			transactionName: this._transactionName,
			conversationId: this._conversationId
		};
	}
	/**
	* Add data which will be accessible during event processing but won't get sent to Sentry.
	*/
	setSDKProcessingMetadata(newData) {
		this._sdkProcessingMetadata = merge(this._sdkProcessingMetadata, newData, 2);
		return this;
	}
	/**
	* Add propagation context to the scope, used for distributed tracing
	*/
	setPropagationContext(context) {
		this._propagationContext = context;
		return this;
	}
	/**
	* Get propagation context from the scope, used for distributed tracing
	*/
	getPropagationContext() {
		return this._propagationContext;
	}
	/**
	* Capture an exception for this scope.
	*
	* @returns {string} The id of the captured Sentry event.
	*/
	captureException(exception, hint) {
		const eventId = hint?.event_id || uuid4();
		if (!this._client) {
			DEBUG_BUILD$2 && debug.warn("No client configured on scope - will not capture exception!");
			return eventId;
		}
		const syntheticException = /* @__PURE__ */ new Error("Sentry syntheticException");
		this._client.captureException(exception, {
			originalException: exception,
			syntheticException,
			...hint,
			event_id: eventId
		}, this);
		return eventId;
	}
	/**
	* Capture a message for this scope.
	*
	* @returns {string} The id of the captured message.
	*/
	captureMessage(message, level, hint) {
		const eventId = hint?.event_id || uuid4();
		if (!this._client) {
			DEBUG_BUILD$2 && debug.warn("No client configured on scope - will not capture message!");
			return eventId;
		}
		const syntheticException = hint?.syntheticException ?? new Error(message);
		this._client.captureMessage(message, level, {
			originalException: message,
			syntheticException,
			...hint,
			event_id: eventId
		}, this);
		return eventId;
	}
	/**
	* Capture a Sentry event for this scope.
	*
	* @returns {string} The id of the captured event.
	*/
	captureEvent(event, hint) {
		const eventId = event.event_id || hint?.event_id || uuid4();
		if (!this._client) {
			DEBUG_BUILD$2 && debug.warn("No client configured on scope - will not capture event!");
			return eventId;
		}
		this._client.captureEvent(event, {
			...hint,
			event_id: eventId
		}, this);
		return eventId;
	}
	/**
	* This will be called on every set call.
	*/
	_notifyScopeListeners() {
		if (!this._notifyingListeners) {
			this._notifyingListeners = true;
			this._scopeListeners.forEach((callback) => {
				callback(this);
			});
			this._notifyingListeners = false;
		}
	}
};

// src/defaultScopes.ts
/** Get the default current scope. */
function getDefaultCurrentScope() {
	return getGlobalSingleton("defaultCurrentScope", () => new Scope());
}
/** Get the default isolation scope. */
function getDefaultIsolationScope() {
	return getGlobalSingleton("defaultIsolationScope", () => new Scope());
}

// src/tracing/constants.ts
const SUPPRESS_TRACING_KEY = "__SENTRY_SUPPRESS_TRACING__";

// src/utils/chain-and-copy-promiselike.ts
const isActualPromise = (p) => p instanceof Promise && !p[kChainedCopy];
const kChainedCopy = Symbol("chained PromiseLike");
/**
* Copy the properties from a decorated promiselike object onto its chained
* actual promise.
*/
const chainAndCopyPromiseLike = (original, onSuccess, onError) => {
	const chained = original.then((value) => {
		onSuccess(value);
		return value;
	}, (err) => {
		onError(err);
		throw err;
	});
	return isActualPromise(chained) && isActualPromise(original) ? chained : copyProps(original, chained);
};
const copyProps = (original, chained) => {
	if (!chained) return original;
	let mutated = false;
	for (const key in original) {
		if (key in chained) continue;
		mutated = true;
		const value = original[key];
		if (typeof value === "function") Object.defineProperty(chained, key, {
			value: (...args) => value.apply(original, args),
			enumerable: true,
			configurable: true,
			writable: true
		});
		else chained[key] = value;
	}
	if (mutated) Object.assign(chained, { [kChainedCopy]: true });
	return chained;
};

// src/asyncContext/stackStrategy.ts
/**
* This is an object that holds a stack of scopes.
*/
var AsyncContextStack = class {
	constructor(scope, isolationScope) {
		let assignedScope;
		if (!scope) assignedScope = new Scope();
		else assignedScope = scope;
		let assignedIsolationScope;
		if (!isolationScope) assignedIsolationScope = new Scope();
		else assignedIsolationScope = isolationScope;
		this._stack = [{ scope: assignedScope }];
		this._isolationScope = assignedIsolationScope;
	}
	/**
	* Fork a scope for the stack.
	*/
	withScope(callback) {
		const scope = this._pushScope();
		let maybePromiseResult;
		try {
			maybePromiseResult = callback(scope);
		} catch (e) {
			this._popScope();
			throw e;
		}
		if (isThenable(maybePromiseResult)) return chainAndCopyPromiseLike(maybePromiseResult, () => this._popScope(), () => this._popScope());
		this._popScope();
		return maybePromiseResult;
	}
	/**
	* Get the client of the stack.
	*/
	getClient() {
		return this.getStackTop().client;
	}
	/**
	* Returns the scope of the top stack.
	*/
	getScope() {
		return this.getStackTop().scope;
	}
	/**
	* Get the isolation scope for the stack.
	*/
	getIsolationScope() {
		return this._isolationScope;
	}
	/**
	* Returns the topmost scope layer in the order domain > local > process.
	*/
	getStackTop() {
		return this._stack[this._stack.length - 1];
	}
	/**
	* Push a scope to the stack.
	*/
	_pushScope() {
		const scope = this.getScope().clone();
		this._stack.push({
			client: this.getClient(),
			scope
		});
		return scope;
	}
	/**
	* Pop a scope from the stack.
	*/
	_popScope() {
		if (this._stack.length <= 1) return false;
		return !!this._stack.pop();
	}
};
/**
* Get the global async context stack.
* This will be removed during the v8 cycle and is only here to make migration easier.
*/
function getAsyncContextStack() {
	const registry = getMainCarrier();
	const sentry = getSentryCarrier(registry);
	return sentry.stack = sentry.stack || new AsyncContextStack(getDefaultCurrentScope(), getDefaultIsolationScope());
}
function withScope$1(callback) {
	return getAsyncContextStack().withScope(callback);
}
function withSetScope(scope, callback) {
	const stack = getAsyncContextStack();
	return stack.withScope(() => {
		stack.getStackTop().scope = scope;
		return callback(scope);
	});
}
function withIsolationScope(callback) {
	return getAsyncContextStack().withScope(() => {
		return callback(getAsyncContextStack().getIsolationScope());
	});
}
/**
* Get the stack-based async context strategy.
*/
function getStackAsyncContextStrategy() {
	return {
		suppressTracing: suppressTracingInStack,
		withIsolationScope,
		withScope: withScope$1,
		withSetScope,
		withSetIsolationScope: (_isolationScope, callback) => {
			return withIsolationScope(callback);
		},
		getCurrentScope: () => getAsyncContextStack().getScope(),
		getIsolationScope: () => getAsyncContextStack().getIsolationScope()
	};
}
/**
* In stack-based ACS, we do not wait for the callback to finish before we reset the metadata
* the reason for this is that otherwise, in the stack this can lead to very weird behavior
* as there is only a single top scope, if the callback takes longer to finish,
* other, unrelated spans may also be suppressed, which we do not want
* so instead, we only suppress tracing synchronoysly in the stack.
*/
function suppressTracingInStack(callback) {
	return withScope$1((scope) => {
		scope.setSDKProcessingMetadata({ [SUPPRESS_TRACING_KEY]: true });
		const res = callback();
		scope.setSDKProcessingMetadata({ [SUPPRESS_TRACING_KEY]: void 0 });
		return res;
	});
}

/**
* Get the current async context strategy.
* If none has been setup, the default will be used.
*/
function getAsyncContextStrategy(carrier) {
	const sentry = getSentryCarrier(carrier);
	if (sentry.acs) return sentry.acs;
	return getStackAsyncContextStrategy();
}

// src/attributes.ts
/**
* Type-guard: The attribute object has the shape the official attribute object (value, type, unit).
* https://develop.sentry.dev/sdk/telemetry/scopes/#setting-attributes
*/
function isAttributeObject(maybeObj) {
	return typeof maybeObj === "object" && maybeObj != null && !Array.isArray(maybeObj) && Object.keys(maybeObj).includes("value");
}
/**
* Converts an attribute value to a typed attribute value.
*
* For now, we support primitive values and arrays, either raw or inside attribute objects.
* If @param useFallback is true, we stringify other non-primitive values to a string attribute
* value. Otherwise we return `undefined` for unsupported values.
*
* @param value - The value of the passed attribute.
* @param useFallback - If true, unsupported values will be stringified to a string attribute value.
*                      Defaults to false. In this case, `undefined` is returned for unsupported values.
* @returns The typed attribute.
*/
function attributeValueToTypedAttributeValue(rawValue, useFallback) {
	const { value, unit } = isAttributeObject(rawValue) ? rawValue : {
		value: rawValue,
		unit: void 0
	};
	const attributeValue = getTypedAttributeValue(value);
	const checkedUnit = unit && typeof unit === "string" ? { unit } : {};
	if (attributeValue) return {
		...attributeValue,
		...checkedUnit
	};
	if (!useFallback || useFallback === "skip-undefined" && value === void 0) return;
	let stringValue = "";
	try {
		stringValue = JSON.stringify(value) ?? "";
	} catch {}
	return {
		value: stringValue,
		type: "string",
		...checkedUnit
	};
}
/**
* Serializes raw attributes to typed attributes as expected in our envelopes.
*
* @param attributes The raw attributes to serialize.
* @param fallback   If true, unsupported values will be stringified to a string attribute value.
*                   Defaults to false. In this case, `undefined` is returned for unsupported values.
*
* @returns The serialized attributes.
*/
function serializeAttributes(attributes, fallback = false) {
	const serializedAttributes = {};
	for (const [key, value] of Object.entries(attributes ?? {})) {
		const typedValue = attributeValueToTypedAttributeValue(value, fallback);
		if (typedValue) serializedAttributes[key] = typedValue;
	}
	return serializedAttributes;
}
/**
* NOTE: We return typed attributes for primitives and arrays:
*  - Relay currently only supports arrays consisting of primitive values. Attributes with non-conforming arrays are dropped by Relay, so runtime type validation in the SDK is unnecessary.
*  - Objects are not supported yet and product support is still TBD.
*/
function getTypedAttributeValue(value) {
	if (Array.isArray(value)) return {
		value,
		type: "array"
	};
	const primitiveType = typeof value === "string" ? "string" : typeof value === "boolean" ? "boolean" : typeof value === "number" && !Number.isNaN(value) ? Number.isInteger(value) ? "integer" : "double" : null;
	if (primitiveType) return {
		value,
		type: primitiveType
	};
}

/**
* Get the external propagation context, if a provider has been registered.
*/
function getExternalPropagationContext() {
	return getSentryCarrier(getMainCarrier()).externalPropagationContextProvider?.();
}
/**
* Get the currently active scope.
*/
function getCurrentScope() {
	const carrier = getMainCarrier();
	return getAsyncContextStrategy(carrier).getCurrentScope();
}
/**
* Get the currently active isolation scope.
* The isolation scope is active for the current execution context.
*/
function getIsolationScope() {
	const carrier = getMainCarrier();
	return getAsyncContextStrategy(carrier).getIsolationScope();
}
/**
* Get the global scope.
* This scope is applied to _all_ events.
*/
function getGlobalScope() {
	return getGlobalSingleton("globalScope", () => new Scope());
}
/**
* Either creates a new active scope, or sets the given scope as active scope in the given callback.
*/
function withScope(...rest) {
	const carrier = getMainCarrier();
	const acs = getAsyncContextStrategy(carrier);
	if (rest.length === 2) {
		const [scope, callback] = rest;
		if (!scope) return acs.withScope(callback);
		return acs.withSetScope(scope, callback);
	}
	return acs.withScope(rest[0]);
}
/**
* Get the currently active client.
*/
function getClient() {
	return getCurrentScope().getClient();
}
/**
* Get a trace context for the given scope.
*/
function getTraceContextFromScope(scope) {
	const externalContext = getExternalPropagationContext();
	if (externalContext) return {
		trace_id: externalContext.traceId,
		span_id: externalContext.spanId
	};
	const { traceId, parentSpanId, propagationSpanId } = scope.getPropagationContext();
	const traceContext = {
		trace_id: traceId,
		span_id: propagationSpanId || generateSpanId()
	};
	if (parentSpanId) traceContext.parent_span_id = parentSpanId;
	return traceContext;
}

// src/types/spanStatus.ts
const SPAN_STATUS_TYPES = [
	"ok",
	"deadline_exceeded",
	"unauthenticated",
	"permission_denied",
	"not_found",
	"resource_exhausted",
	"invalid_argument",
	"unimplemented",
	"unavailable",
	"internal_error",
	"unknown_error",
	"cancelled",
	"already_exists",
	"failed_precondition",
	"aborted",
	"out_of_range",
	"data_loss"
];

const wa="culture.calendar",Ra="culture.locale",Na="culture.timezone",Fr="gen_ai.conversation.id",cl="http.request.header",Wm="sentry.exclusive_time",$m="sentry.is_localhost",yb="sentry.op",_b="sentry.origin",kb="sentry.profile_id",qb="sentry.segment.name.source",py="url.full",vy="user_agent.original";

function isStatusErrorMessageValid(message) {
	return message !== "ok" && SPAN_STATUS_TYPES.includes(message);
}

/**
* Resolves a potentially weak reference, returning the underlying object
* or undefined if the reference has been garbage collected.
*
* @param ref - A MaybeWeakRef or undefined
* @returns The referenced object, or undefined if GC'd or ref was undefined
*/
function derefWeakRef(ref) {
	if (!ref) return;
	if (typeof ref === "object" && "deref" in ref && typeof ref.deref === "function") try {
		return ref.deref();
	} catch {
		return;
	}
	return ref;
}

// src/tracing/utils.ts
const SCOPE_ON_START_SPAN_FIELD = "_sentryScope";
const ISOLATION_SCOPE_ON_START_SPAN_FIELD = "_sentryIsolationScope";
/**
* Grabs the scope and isolation scope off a span that were active when the span was started.
* If WeakRef was used and scopes have been garbage collected, returns undefined for those scopes.
*/
function getCapturedScopesOnSpan(span) {
	const spanWithScopes = span;
	return {
		scope: spanWithScopes[SCOPE_ON_START_SPAN_FIELD],
		isolationScope: derefWeakRef(spanWithScopes[ISOLATION_SCOPE_ON_START_SPAN_FIELD])
	};
}

/**
* Takes a baggage header and turns it into Dynamic Sampling Context, by extracting all the "sentry-" prefixed values
* from it.
*
* @param baggageHeader A very bread definition of a baggage header as it might appear in various frameworks.
* @returns The Dynamic Sampling Context that was found on `baggageHeader`, if there was any, `undefined` otherwise.
*/
function baggageHeaderToDynamicSamplingContext(baggageHeader) {
	const baggageObject = parseBaggageHeader(baggageHeader);
	if (!baggageObject) return;
	const dynamicSamplingContext = Object.entries(baggageObject).reduce((acc, [key, value]) => {
		if (key.startsWith("sentry-")) {
			const nonPrefixedKey = key.slice(7);
			acc[nonPrefixedKey] = value;
		}
		return acc;
	}, {});
	if (Object.keys(dynamicSamplingContext).length > 0) return dynamicSamplingContext;
	else return;
}
/**
* Take a baggage header and parse it into an object.
*/
function parseBaggageHeader(baggageHeader) {
	if (!baggageHeader || !isString(baggageHeader) && !Array.isArray(baggageHeader)) return;
	if (Array.isArray(baggageHeader)) return baggageHeader.reduce((acc, curr) => {
		const currBaggageObject = baggageHeaderToObject(curr);
		Object.entries(currBaggageObject).forEach(([key, value]) => {
			acc[key] = value;
		});
		return acc;
	}, {});
	return baggageHeaderToObject(baggageHeader);
}
/**
* Will parse a baggage header, which is a simple key-value map, into a flat object.
*
* @param baggageHeader The baggage header to parse.
* @returns a flat object containing all the key-value pairs from `baggageHeader`.
*/
function baggageHeaderToObject(baggageHeader) {
	return baggageHeader.split(",").map((baggageEntry) => {
		const eqIdx = baggageEntry.indexOf("=");
		if (eqIdx === -1) return [];
		return [baggageEntry.slice(0, eqIdx), baggageEntry.slice(eqIdx + 1)].map((keyOrValue) => {
			try {
				return decodeURIComponent(keyOrValue.trim());
			} catch {
				return;
			}
		});
	}).reduce((acc, [key, value]) => {
		if (key && value) acc[key] = value;
		return acc;
	}, {});
}

// src/utils/dsn.ts
/** Regular expression used to extract org ID from a DSN host. */
const ORG_ID_REGEX = /^o(\d+)\./;
/** Regular expression used to parse a Dsn. */
const DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)((?:\[[:.%\w]+\]|[\w.-]+))(?::(\d+))?\/(.+)/;
function isValidProtocol(protocol) {
	return protocol === "http" || protocol === "https";
}
/**
* Renders the string representation of this Dsn.
*
* By default, this will render the public representation without the password
* component. To get the deprecated private representation, set `withPassword`
* to true.
*
* @param withPassword When set to true, the password will be included.
*/
function dsnToString(dsn, withPassword = false) {
	const { host, path, pass, port, projectId, protocol, publicKey } = dsn;
	return `${protocol}://${publicKey}${withPassword && pass ? `:${pass}` : ""}@${host}${port ? `:${port}` : ""}/${path ? `${path}/` : path}${projectId}`;
}
/**
* Parses a Dsn from a given string.
*
* @param str A Dsn as string
* @returns Dsn as DsnComponents or undefined if @param str is not a valid DSN string
*/
function dsnFromString(str) {
	const match = DSN_REGEX.exec(str);
	if (!match) {
		consoleSandbox(() => {
			console.error(`Invalid Sentry Dsn: ${str}`);
		});
		return;
	}
	const [protocol, publicKey, pass = "", host = "", port = "", lastPath = ""] = match.slice(1);
	let path = "";
	let projectId = lastPath;
	const split = projectId.split("/");
	if (split.length > 1) {
		path = split.slice(0, -1).join("/");
		projectId = split.pop();
	}
	if (projectId) {
		const projectMatch = projectId.match(/^\d+/);
		if (projectMatch) projectId = projectMatch[0];
	}
	return dsnFromComponents({
		host,
		pass,
		path,
		projectId,
		port,
		protocol,
		publicKey
	});
}
function dsnFromComponents(components) {
	return {
		protocol: components.protocol,
		publicKey: components.publicKey || "",
		pass: components.pass || "",
		host: components.host,
		port: components.port || "",
		path: components.path || "",
		projectId: components.projectId
	};
}
function validateDsn(dsn) {
	if (!DEBUG_BUILD$2) return true;
	const { port, projectId, protocol } = dsn;
	if ([
		"protocol",
		"publicKey",
		"host",
		"projectId"
	].find((component) => {
		if (!dsn[component]) {
			debug.error(`Invalid Sentry Dsn: ${component} missing`);
			return true;
		}
		return false;
	})) return false;
	if (!projectId.match(/^\d+$/)) {
		debug.error(`Invalid Sentry Dsn: Invalid projectId ${projectId}`);
		return false;
	}
	if (!isValidProtocol(protocol)) {
		debug.error(`Invalid Sentry Dsn: Invalid protocol ${protocol}`);
		return false;
	}
	if (port && isNaN(parseInt(port, 10))) {
		debug.error(`Invalid Sentry Dsn: Invalid port ${port}`);
		return false;
	}
	return true;
}
/**
* Extract the org ID from a DSN host.
*
* @param host The host from a DSN
* @returns The org ID if found, undefined otherwise
*/
function extractOrgIdFromDsnHost(host) {
	return host.match(ORG_ID_REGEX)?.[1];
}
/**
*  Returns the organization ID of the client.
*
*  The organization ID is extracted from the DSN. If the client options include a `orgId`, this will always take precedence.
*/
function extractOrgIdFromClient(client) {
	const options = client.getOptions();
	const { host } = client.getDsn() || {};
	let org_id;
	if (options.orgId) org_id = String(options.orgId);
	else if (host) org_id = extractOrgIdFromDsnHost(host);
	return org_id;
}
/**
* Creates a valid Sentry Dsn object, identifying a Sentry instance and project.
* @returns a valid DsnComponents object or `undefined` if @param from is an invalid DSN source
*/
function makeDsn(from) {
	const components = typeof from === "string" ? dsnFromString(from) : dsnFromComponents(from);
	if (!components || !validateDsn(components)) return;
	return components;
}

// src/utils/parseSampleRate.ts
/**
* Parse a sample rate from a given value.
* This will either return a boolean or number sample rate, if the sample rate is valid (between 0 and 1).
* If a string is passed, we try to convert it to a number.
*
* Any invalid sample rate will return `undefined`.
*/
function parseSampleRate(sampleRate) {
	if (typeof sampleRate === "boolean") return Number(sampleRate);
	const rate = typeof sampleRate === "string" ? parseFloat(sampleRate) : sampleRate;
	if (typeof rate !== "number" || isNaN(rate) || rate < 0 || rate > 1) return;
	return rate;
}

// src/utils/spanOnScope.ts
const SCOPE_SPAN_FIELD = "span";
/**
* Get the active span for a given scope.
* NOTE: This should NOT be used directly, but is only used internally by the trace methods.
*/
function _getSpanForScope(scope) {
	return derefWeakRef(scope.refs[SCOPE_SPAN_FIELD]);
}

/**
* Convert a span to a trace context, which can be sent as the `trace` context in a non-transaction event.
*/
function spanToTraceContext(span) {
	const { spanId, traceId: trace_id, isRemote } = span.spanContext();
	const parent_span_id = isRemote ? spanId : spanToStaticSpanJSON(span).parent_span_id;
	const scope = getCapturedScopesOnSpan(span).scope;
	return {
		parent_span_id,
		span_id: isRemote ? scope?.getPropagationContext().propagationSpanId || generateSpanId() : spanId,
		trace_id
	};
}
/**
*  Converts the span links array to a flattened version to be sent within an envelope.
*
*  If the links array is empty, it returns `undefined` so the empty value can be dropped before it's sent.
*/
function convertSpanLinksForEnvelope(links) {
	if (links && links.length > 0) return links.map(({ context: { spanId, traceId, traceFlags, ...restContext }, attributes }) => ({
		span_id: spanId,
		trace_id: traceId,
		sampled: traceFlags === 1,
		attributes,
		...restContext
	}));
	else return;
}
/**
* Convert a span time input into a timestamp in seconds.
*/
function spanTimeInputToSeconds(input) {
	if (typeof input === "number") return ensureTimestampInSeconds(input);
	if (Array.isArray(input)) return input[0] + input[1] / 1e9;
	if (input instanceof Date) return ensureTimestampInSeconds(input.getTime());
	return timestampInSeconds();
}
/**
* Converts a timestamp to second, if it was in milliseconds, or keeps it as second.
*/
function ensureTimestampInSeconds(timestamp) {
	return timestamp > 9999999999 ? timestamp / 1e3 : timestamp;
}
/**
* Convert a span to a static JSON representation.
*/
function spanToStaticSpanJSON(span) {
	if (spanIsSentrySpan(span)) return span.getStaticSpanJSON();
	const { spanId: span_id, traceId: trace_id } = span.spanContext();
	if (spanIsOpenTelemetrySdkTraceBaseSpan(span)) {
		const { attributes, startTime, name, endTime, status, links } = span;
		return {
			span_id,
			trace_id,
			data: attributes,
			description: name,
			parent_span_id: getOtelParentSpanId(span),
			start_timestamp: spanTimeInputToSeconds(startTime),
			timestamp: spanTimeInputToSeconds(endTime) || void 0,
			status: getStatusMessage(status),
			op: attributes[yb],
			origin: attributes[_b],
			links: convertSpanLinksForEnvelope(links)
		};
	}
	return {
		span_id,
		trace_id,
		start_timestamp: 0,
		status: "ok",
		data: {}
	};
}
/**
* In preparation for the next major of OpenTelemetry, we want to support
* looking up the parent span id according to the new API
* In OTel v1, the parent span id is accessed as `parentSpanId`
* In OTel v2, the parent span id is accessed as `spanId` on the `parentSpanContext`
*/
function getOtelParentSpanId(span) {
	return "parentSpanId" in span ? span.parentSpanId : "parentSpanContext" in span ? span.parentSpanContext?.spanId : void 0;
}
/**
* Converts a {@link StreamedSpanJSON} to a {@link SerializedSpan}.
* This is the final serialized span format that is sent to Sentry.
* The returned serilaized spans must not be consumed by users or SDK integrations.
*/
function streamedSpanJsonToSerializedSpan(spanJson) {
	return {
		...spanJson,
		end_timestamp: spanJson.end_timestamp ?? spanJson.start_timestamp,
		attributes: serializeAttributes(spanJson.attributes),
		links: spanJson.links?.map((link) => ({
			...link,
			attributes: serializeAttributes(link.attributes)
		}))
	};
}
function spanIsOpenTelemetrySdkTraceBaseSpan(span) {
	const castSpan = span;
	return !!castSpan.attributes && !!castSpan.startTime && !!castSpan.name && !!castSpan.endTime && !!castSpan.status;
}
/**
* Sadly, due to circular dependency checks we cannot actually import the Span class here and check for instanceof.
* :( So instead we approximate this by checking if it has the `getSpanJSON` method.
*/
function spanIsSentrySpan(span) {
	return typeof span.getSpanJSON === "function";
}
/**
* Returns true if a span is sampled.
* In most cases, you should just use `span.isRecording()` instead.
* However, this has a slightly different semantic, as it also returns false if the span is finished.
* So in the case where this distinction is important, use this method.
*/
function spanIsSampled(span) {
	const { traceFlags } = span.spanContext();
	return traceFlags === 1;
}
/** Get the status message to use for a JSON representation of a span. */
function getStatusMessage(status) {
	if (!status || status.code === 0) return "ok";
	if (status.code === 1) return "ok";
	return status.message && isStatusErrorMessageValid(status.message) ? status.message : "internal_error";
}
const ROOT_SPAN_FIELD = "_sentryRootSpan";
/**
* Returns the root span of a given span.
*/
const getRootSpan = INTERNAL_getSegmentSpan;
/**
* Returns the segment span of a given span.
*/
function INTERNAL_getSegmentSpan(span) {
	return span[ROOT_SPAN_FIELD] || span;
}
/**
* Returns the currently active span.
*/
function getActiveSpan(scope) {
	const carrier = getMainCarrier();
	const acs = getAsyncContextStrategy(carrier);
	if (acs.getActiveSpan) return acs.getActiveSpan(scope);
	return _getSpanForScope(scope || getCurrentScope());
}

// src/utils/hasSpansEnabled.ts
/**
* Determines if span recording is currently enabled.
*
* Spans are recorded when at least one of `tracesSampleRate` and `tracesSampler`
* is defined in the SDK config. This function does not make any assumption about
* sampling decisions, it only checks if the SDK is configured to record spans.
*
* Important: This function only determines if span recording is enabled. Trace
* continuation and propagation is separately controlled and not covered by this function.
* If this function returns `false`, traces can still be propagated (which is what
* we refer to by "Tracing without Performance")
* @see https://develop.sentry.dev/sdk/telemetry/traces/tracing-without-performance/
*
* @param maybeOptions An SDK options object to be passed to this function.
* If this option is not provided, the function will use the current client's options.
*/
function hasSpansEnabled(maybeOptions) {
	if (typeof __SENTRY_TRACING__ === "boolean" && !__SENTRY_TRACING__) return false;
	const options = maybeOptions || getClient()?.getOptions();
	return !!options && (options.tracesSampleRate != null || !!options.tracesSampler);
}

// src/utils/should-ignore-span.ts
function logIgnoredSpan(droppedSpan) {
	debug.log(`Ignoring span ${droppedSpan.op} - ${droppedSpan.description} because it matches \`ignoreSpans\`.`);
}
/**
* Check if a span should be ignored based on the ignoreSpans configuration.
*/
function shouldIgnoreSpan(span, ignoreSpans) {
	if (!ignoreSpans?.length) return false;
	for (const pattern of ignoreSpans) {
		if (isStringOrRegExp(pattern)) {
			if (span.description && isMatchingPattern(span.description, pattern)) {
				DEBUG_BUILD$2 && logIgnoredSpan(span);
				return true;
			}
			continue;
		}
		const hasAttributes = !!pattern.attributes && Object.keys(pattern.attributes).length > 0;
		if (!pattern.name && !pattern.op && !hasAttributes) continue;
		const nameMatches = pattern.name ? span.description && isMatchingPattern(span.description, pattern.name) : true;
		const opMatches = pattern.op ? span.op && isMatchingPattern(span.op, pattern.op) : true;
		const attrsMatch = pattern.attributes ? Object.entries(pattern.attributes).every(([key, valuePattern]) => _matchesAttributeValue(span.attributes?.[key], valuePattern)) : true;
		if (nameMatches && opMatches && attrsMatch) {
			DEBUG_BUILD$2 && logIgnoredSpan(span);
			return true;
		}
	}
	return false;
}
function _matchesAttributeValue(actual, pat) {
	if (typeof actual === "string" && (typeof pat === "string" || pat instanceof RegExp)) return isMatchingPattern(actual, pat);
	if (Array.isArray(actual) && Array.isArray(pat)) return actual.length === pat.length && actual.every((v, i) => v === pat[i]);
	return actual === pat;
}
/**
* Takes a list of spans, and a span that was dropped, and re-parents the child spans of the dropped span to the parent of the dropped span, if possible.
* This mutates the spans array in place!
*/
function reparentChildSpans(spans, dropSpan) {
	const droppedSpanParentId = dropSpan.parent_span_id;
	const droppedSpanId = dropSpan.span_id;
	if (!droppedSpanParentId) return;
	for (const span of spans) if (span.parent_span_id === droppedSpanId) span.parent_span_id = droppedSpanParentId;
}
function isStringOrRegExp(value) {
	return typeof value === "string" || value instanceof RegExp;
}

// src/integration.ts
const installedIntegrations = [];
/**
* Remove duplicates from the given array, preferring the last instance of any duplicate. Not guaranteed to
* preserve the order of integrations in the array.
*
* @private
*/
function filterDuplicates(integrations) {
	const integrationsByName = {};
	integrations.forEach((currentInstance) => {
		const { name } = currentInstance;
		const existingInstance = integrationsByName[name];
		if (existingInstance && !existingInstance.isDefaultInstance && currentInstance.isDefaultInstance) return;
		integrationsByName[name] = currentInstance;
	});
	return Object.values(integrationsByName);
}
/** Gets integrations to install */
function getIntegrationsToSetup(options) {
	const defaultIntegrations = options.defaultIntegrations || [];
	const userIntegrations = options.integrations;
	defaultIntegrations.forEach((integration) => {
		integration.isDefaultInstance = true;
	});
	let integrations;
	if (Array.isArray(userIntegrations)) integrations = [...defaultIntegrations, ...userIntegrations];
	else if (typeof userIntegrations === "function") {
		const resolvedUserIntegrations = userIntegrations(defaultIntegrations);
		integrations = Array.isArray(resolvedUserIntegrations) ? resolvedUserIntegrations : [resolvedUserIntegrations];
	} else integrations = defaultIntegrations;
	return filterDuplicates(integrations);
}
/**
* Given a list of integration instances this installs them all. When `withDefaults` is set to `true` then all default
* integrations are added unless they were already provided before.
* @param integrations array of integration instances
* @param withDefault should enable default integrations
*/
function setupIntegrations(client, integrations) {
	const integrationIndex = {};
	integrations.forEach((integration) => {
		if (integration?.beforeSetup) integration.beforeSetup(client);
	});
	integrations.forEach((integration) => {
		if (integration) setupIntegration(client, integration, integrationIndex);
	});
	return integrationIndex;
}
/**
* Execute the `afterAllSetup` hooks of the given integrations.
*/
function afterSetupIntegrations(client, integrations) {
	for (const integration of integrations) if (integration?.afterAllSetup) integration.afterAllSetup(client);
}
/** Setup a single integration.  */
function setupIntegration(client, integration, integrationIndex) {
	if (integrationIndex[integration.name]) {
		DEBUG_BUILD$2 && debug.log(`Integration skipped because it was already installed: ${integration.name}`);
		return;
	}
	integrationIndex[integration.name] = integration;
	if (!installedIntegrations.includes(integration.name) && typeof integration.setupOnce === "function") {
		integration.setupOnce();
		installedIntegrations.push(integration.name);
	}
	if (integration.setup && typeof integration.setup === "function") integration.setup(client);
	if (typeof integration.preprocessEvent === "function") {
		const callback = integration.preprocessEvent.bind(integration);
		client.on("preprocessEvent", (event, hint) => callback(event, hint, client));
	}
	if (typeof integration.processEvent === "function") {
		const callback = integration.processEvent.bind(integration);
		const processor = Object.assign((event, hint) => callback(event, hint, client), { id: integration.name });
		client.addEventProcessor(processor);
	}
	["processSpan", "processSegmentSpan"].forEach((hook) => {
		const callback = integration[hook];
		if (typeof callback === "function") client.on(hook, (span) => callback.call(integration, span, client));
	});
	DEBUG_BUILD$2 && debug.log(`Integration installed: ${integration.name}`);
}
/**
* Define an integration function that can be used to create an integration instance.
* Note that this by design hides the implementation details of the integration, as they are considered internal.
*/
function defineIntegration(fn) {
	return fn;
}

// src/constants.ts
const DEFAULT_ENVIRONMENT = "production";

// src/tracing/sentryNonRecordingSpan.ts
const NON_RECORDING_SPAN_FIELD = Symbol.for("sentry.nonRecordingSpan");
/**
* Whether the given span is a {@link SentryNonRecordingSpan}.
*/
function spanIsNonRecordingSpan(span) {
	return !!span && span[NON_RECORDING_SPAN_FIELD] === true;
}

// src/tracing/dynamicSamplingContext.ts
/**
* If you change this value, also update the terser plugin config to
* avoid minification of the object property!
*/
const FROZEN_DSC_FIELD = "_frozenDsc";
/**
* Creates a dynamic sampling context from a client.
*
* Dispatches the `createDsc` lifecycle hook as a side effect.
*/
function getDynamicSamplingContextFromClient(trace_id, client) {
	const options = client.getOptions();
	const { publicKey: public_key } = client.getDsn() || {};
	const dsc = {
		environment: options.environment || "production",
		release: options.release,
		public_key,
		trace_id,
		org_id: extractOrgIdFromClient(client)
	};
	client.emit("createDsc", dsc);
	return dsc;
}
/**
* Get the dynamic sampling context for the currently active scopes.
*/
function getDynamicSamplingContextFromScope(client, scope) {
	if (getExternalPropagationContext()) return;
	const propagationContext = scope.getPropagationContext();
	return propagationContext.dsc || getDynamicSamplingContextFromClient(propagationContext.traceId, client);
}
/**
* Creates a dynamic sampling context from a span (and client and scope)
*
* @param span the span from which a few values like the root span name and sample rate are extracted.
*
* @returns a dynamic sampling context
*/
function getDynamicSamplingContextFromSpan(span) {
	const client = getClient();
	if (!client) return {};
	const rootSpan = getRootSpan(span);
	const rootSpanJson = spanToStaticSpanJSON(rootSpan);
	const rootSpanAttributes = rootSpanJson.data;
	const traceState = rootSpan.spanContext().traceState;
	const rootSpanSampleRate = traceState?.get("sentry.sample_rate") ?? rootSpanAttributes["sentry.sample_rate"] ?? rootSpanAttributes["sentry.previous_trace_sample_rate"];
	function applyLocalSampleRateToDsc(dsc) {
		if (typeof rootSpanSampleRate === "number" || typeof rootSpanSampleRate === "string") dsc.sample_rate = `${rootSpanSampleRate}`;
		return dsc;
	}
	const frozenDsc = rootSpan[FROZEN_DSC_FIELD];
	if (frozenDsc) return applyLocalSampleRateToDsc(frozenDsc);
	const isNonRecordingRoot = spanIsNonRecordingSpan(rootSpan);
	const isIgnoredRoot = isNonRecordingRoot && rootSpan.dropReason === "ignored";
	if (isNonRecordingRoot && (!hasSpansEnabled(client.getOptions()) || isIgnoredRoot)) {
		const capturedScope = getCapturedScopesOnSpan(rootSpan).scope;
		const scopeDsc = capturedScope && getDynamicSamplingContextFromScope(client, capturedScope);
		if (scopeDsc) {
			const dsc = { ...scopeDsc };
			if (isIgnoredRoot) dsc.sampled = "false";
			return applyLocalSampleRateToDsc(dsc);
		}
	}
	const traceStateDsc = traceState?.get("sentry.dsc");
	const dscOnTraceState = traceStateDsc && baggageHeaderToDynamicSamplingContext(traceStateDsc);
	if (dscOnTraceState) return applyLocalSampleRateToDsc(dscOnTraceState);
	const dsc = getDynamicSamplingContextFromClient(span.spanContext().traceId, client);
	const source = rootSpanAttributes[qb];
	const name = rootSpanJson.description;
	if (source !== "url" && name) dsc.transaction = name;
	if (hasSpansEnabled()) {
		dsc.sampled = String(spanIsSampled(rootSpan));
		dsc.sample_rand = traceState?.get("sentry.sample_rand") ?? getCapturedScopesOnSpan(rootSpan).scope?.getPropagationContext().sampleRand.toString();
	}
	applyLocalSampleRateToDsc(dsc);
	client.emit("createDsc", dsc, rootSpan);
	return dsc;
}

// src/utils/scopeData.ts
/**
* Applies data from the scope to the event and runs all event processors on it.
*/
function applyScopeDataToEvent(event, data) {
	const { fingerprint, breadcrumbs, sdkProcessingMetadata } = data;
	applyDataToEvent(event, data);
	applyFingerprintToEvent(event, fingerprint);
	applyBreadcrumbsToEvent(event, breadcrumbs);
	applySdkMetadataToEvent(event, sdkProcessingMetadata);
}
/** Merge data of two scopes together. */
function mergeScopeData(data, mergeData) {
	const { extra, tags, attributes, user, contexts, level, sdkProcessingMetadata, breadcrumbs, fingerprint, eventProcessors, attachments, propagationContext, transactionName } = mergeData;
	mergeAndOverwriteScopeData(data, "extra", extra);
	mergeAndOverwriteScopeData(data, "tags", tags);
	mergeAndOverwriteScopeData(data, "attributes", attributes);
	mergeAndOverwriteScopeData(data, "user", user);
	mergeAndOverwriteScopeData(data, "contexts", contexts);
	data.sdkProcessingMetadata = merge(data.sdkProcessingMetadata, sdkProcessingMetadata, 2);
	if (level) data.level = level;
	if (transactionName) data.transactionName = transactionName;
	if (breadcrumbs.length) data.breadcrumbs = [...data.breadcrumbs, ...breadcrumbs];
	if (fingerprint.length) data.fingerprint = [...data.fingerprint, ...fingerprint];
	if (eventProcessors.length) data.eventProcessors = [...data.eventProcessors, ...eventProcessors];
	if (attachments.length) data.attachments = [...data.attachments, ...attachments];
	data.propagationContext = {
		...data.propagationContext,
		...propagationContext
	};
}
/**
* Merges certain scope data. Undefined values will overwrite any existing values.
* Exported only for tests.
*/
function mergeAndOverwriteScopeData(data, prop, mergeVal) {
	data[prop] = merge(data[prop], mergeVal, 1);
}
/**
* Get the scope data for the current scope after merging with the
* global scope and isolation scope.
*
* @param currentScope - The current scope.
* @returns The scope data.
*/
function getCombinedScopeData(isolationScope, currentScope) {
	const scopeData = getGlobalScope().getScopeData();
	isolationScope && mergeScopeData(scopeData, isolationScope.getScopeData());
	currentScope && mergeScopeData(scopeData, currentScope.getScopeData());
	return scopeData;
}
function applyDataToEvent(event, data) {
	const { extra, tags, user, contexts, level, transactionName } = data;
	if (Object.keys(extra).length) event.extra = {
		...extra,
		...event.extra
	};
	if (Object.keys(tags).length) event.tags = {
		...tags,
		...event.tags
	};
	if (Object.keys(user).length) event.user = {
		...user,
		...event.user
	};
	if (Object.keys(contexts).length) event.contexts = {
		...contexts,
		...event.contexts
	};
	if (level) event.level = level;
	if (transactionName && event.type !== "transaction") event.transaction = transactionName;
}
function applyBreadcrumbsToEvent(event, breadcrumbs) {
	const mergedBreadcrumbs = [...event.breadcrumbs || [], ...breadcrumbs];
	event.breadcrumbs = mergedBreadcrumbs.length ? mergedBreadcrumbs : void 0;
}
function applySdkMetadataToEvent(event, sdkProcessingMetadata) {
	event.sdkProcessingMetadata = {
		...event.sdkProcessingMetadata,
		...sdkProcessingMetadata
	};
}
/** Apply a given span to the event. */
function applySpanToEvent(event, span) {
	event.contexts = {
		trace: spanToTraceContext(span),
		...event.contexts
	};
	event.sdkProcessingMetadata = {
		dynamicSamplingContext: getDynamicSamplingContextFromSpan(span),
		...event.sdkProcessingMetadata
	};
	const rootSpan = getRootSpan(span);
	const transactionName = spanToStaticSpanJSON(rootSpan).description;
	if (transactionName && !event.transaction && event.type === "transaction") event.transaction = transactionName;
}
/**
* Applies fingerprint from the scope to the event if there's one,
* uses message if there's one instead or get rid of empty fingerprint
*/
function applyFingerprintToEvent(event, fingerprint) {
	event.fingerprint = event.fingerprint ? Array.isArray(event.fingerprint) ? event.fingerprint : [event.fingerprint] : [];
	if (fingerprint) event.fingerprint = event.fingerprint.concat(fingerprint);
	if (!event.fingerprint.length) delete event.fingerprint;
}

/**
* Invokes a user-provided callback (e.g. `beforeSend`, `tracesSampler`, an integration hook) so that
* neither a synchronous throw nor a rejected promise escapes into the caller. On failure the error is
* logged and `fallback(error)` supplies the result instead.
*
* Not for `startSpan` bodies: those must re-throw and are handled by `handleCallbackErrors`.
*
* @param message - Logged via `debug.error` together with the error. Pass it as `DEBUG_BUILD ? '...' : ''`
*   so the string is tree-shaken from non-debug bundles.
* @param fn - Invokes the callback.
* @param fallback - Produces the result to use when the callback throws or rejects.
*/
function safeCallback(message, fn, fallback) {
	let result;
	try {
		result = fn();
	} catch (error) {
		return recover(message, error, fallback);
	}
	if (isThenable(result)) return result.then(void 0, (error) => recover(message, error, fallback));
	return result;
}
function recover(message, error, fallback) {
	DEBUG_BUILD$2 && debug.error(message, error);
	return fallback(error);
}

/**
* Typesafe check to identify if a `beforeSendSpan` callback expects the static span JSON format.
*
* @param callback - The `beforeSendSpan` callback to check.
* @returns `true` if the callback was wrapped with {@link withStaticSpan}.
*/
function isStaticBeforeSendSpanCallback(callback) {
	return !!callback && typeof callback === "function" && "_static" in callback && !!callback._static;
}
/**
* Apply a user-provided beforeSendSpan callback to a span JSON.
*/
function applyBeforeSendSpanCallback(span, beforeSendSpan) {
	return safeCallback(DEBUG_BUILD$2 ? "The `beforeSendSpan` callback threw an error, sending the span unmodified:" : "", () => beforeSendSpan(span), () => span) || span;
}

// src/tracing/spans/spanJsonToStreamedSpan.ts
/**
* Converts a v1 SpanJSON (from a legacy transaction) to a serialized v2 StreamedSpan.
*/
function spanJsonToSerializedStreamedSpan(span) {
	const streamedSpan = {
		trace_id: span.trace_id,
		span_id: span.span_id,
		parent_span_id: span.parent_span_id,
		name: span.description || "",
		start_timestamp: span.start_timestamp,
		end_timestamp: span.timestamp,
		status: !span.status || span.status === "ok" || span.status === "cancelled" ? "ok" : "error",
		is_segment: false,
		attributes: { ...span.data },
		links: span.links
	};
	return streamedSpanJsonToSerializedSpan(streamedSpan);
}

/**
* Safely set attributes on a span JSON.
* If an attribute already exists, it will not be overwritten.
*/
function safeSetSpanJSONAttributes(spanJSON, newAttributes) {
	const originalAttributes = spanJSON.attributes ?? (spanJSON.attributes = {});
	Object.entries(newAttributes).forEach(([key, value]) => {
		if (value != null && !(key in originalAttributes)) originalAttributes[key] = value;
	});
}

// src/tracing/spans/hasSpanStreamingEnabled.ts
/**
* Determines if span streaming is enabled for the given client
*/
function hasSpanStreamingEnabled(client) {
	return client.getOptions().traceLifecycle === "stream";
}

// src/utils/timer.ts
/**
* Calls `unref` on a timer, if the method is available on @param timer.
*
* `unref()` is used to allow processes to exit immediately, even if the timer
* is still running and hasn't resolved yet.
*
* Use this in places where code can run on browser or server, since browsers
* do not support `unref`.
*/
function safeUnref(timer) {
	if (typeof timer === "object" && typeof timer.unref === "function") timer.unref();
	return timer;
}

// src/utils/envelope.ts
/**
* Creates an envelope.
* Make sure to always explicitly provide the generic to this function
* so that the envelope types resolve correctly.
*/
function createEnvelope(headers, items = []) {
	return [headers, items];
}
/**
* Add an item to an envelope.
* Make sure to always explicitly provide the generic to this function
* so that the envelope types resolve correctly.
*/
function addItemToEnvelope(envelope, newItem) {
	const [headers, items] = envelope;
	return [headers, [...items, newItem]];
}
/**
* Convenience function to loop through the items and item types of an envelope.
* (This function was mostly created because working with envelope types is painful at the moment)
*
* If the callback returns true, the rest of the items will be skipped.
*/
function forEachEnvelopeItem(envelope, callback) {
	const envelopeItems = envelope[1];
	for (const envelopeItem of envelopeItems) {
		const envelopeItemType = envelopeItem[0].type;
		if (callback(envelopeItem, envelopeItemType)) return true;
	}
	return false;
}
/**
* Returns true if the envelope contains any of the given envelope item types
*/
function envelopeContainsItemType(envelope, types) {
	return forEachEnvelopeItem(envelope, (_, type) => types.includes(type));
}
/**
* Encode a string to UTF8 array.
*/
function encodeUTF8(input) {
	const carrier = getSentryCarrier(GLOBAL_OBJ);
	return carrier.encodePolyfill ? carrier.encodePolyfill(input) : new TextEncoder().encode(input);
}
/**
* Serializes an envelope.
*/
function serializeEnvelope(envelope) {
	const [envHeaders, items] = envelope;
	let parts = JSON.stringify(envHeaders);
	function append(next) {
		if (typeof parts === "string") parts = typeof next === "string" ? parts + next : [encodeUTF8(parts), next];
		else parts.push(typeof next === "string" ? encodeUTF8(next) : next);
	}
	for (const item of items) {
		const [itemHeaders, payload] = item;
		append(`\n${JSON.stringify(itemHeaders)}\n`);
		if (typeof payload === "string" || payload instanceof Uint8Array) append(payload);
		else {
			let stringifiedPayload;
			try {
				stringifiedPayload = JSON.stringify(payload);
			} catch {
				stringifiedPayload = JSON.stringify(normalize(payload));
			}
			append(stringifiedPayload);
		}
	}
	return typeof parts === "string" ? parts : concatBuffers(parts);
}
function concatBuffers(buffers) {
	const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
	const merged = new Uint8Array(totalLength);
	let offset = 0;
	for (const buffer of buffers) {
		merged.set(buffer, offset);
		offset += buffer.length;
	}
	return merged;
}
/**
* Creates attachment envelope items
*/
function createAttachmentEnvelopeItem(attachment) {
	const buffer = typeof attachment.data === "string" ? encodeUTF8(attachment.data) : attachment.data;
	return [{
		type: "attachment",
		length: buffer.length,
		filename: attachment.filename,
		content_type: attachment.contentType,
		attachment_type: attachment.attachmentType
	}, buffer];
}
const DATA_CATEGORY_OVERRIDES = {
	sessions: "session",
	event: "error",
	client_report: "internal",
	user_report: "default",
	profile_chunk: "profile",
	replay_event: "replay",
	replay_recording: "replay",
	check_in: "monitor",
	raw_security: "security",
	log: "log_item",
	metric: "trace_metric"
};
function _isOverriddenType(type) {
	return type in DATA_CATEGORY_OVERRIDES;
}
/**
* Maps the type of an envelope item to a data category.
*/
function envelopeItemTypeToDataCategory(type) {
	return _isOverriddenType(type) ? DATA_CATEGORY_OVERRIDES[type] : type;
}
/** Extracts the minimal SDK info from the metadata or an events */
function getSdkMetadataForEnvelopeHeader(metadataOrEvent) {
	if (!metadataOrEvent?.sdk) return;
	const { name, version } = metadataOrEvent.sdk;
	return {
		name,
		version
	};
}
/**
* Creates event envelope headers, based on event, sdk info and tunnel
* Note: This function was extracted from the core package to make it available in Replay
*/
function createEventEnvelopeHeaders(event, sdkInfo, tunnel, dsn) {
	const dynamicSamplingContext = event.sdkProcessingMetadata?.dynamicSamplingContext;
	return {
		event_id: event.event_id,
		sent_at: new Date(safeDateNow()).toISOString(),
		...sdkInfo && { sdk: sdkInfo },
		...!!tunnel && dsn && { dsn: dsnToString(dsn) },
		...dynamicSamplingContext && { trace: dynamicSamplingContext }
	};
}
/**
* Maps an event type to the data category used for client reports.
*/
function getDataCategoryByType(type) {
	return type === "replay_event" ? "replay" : type || "error";
}

// src/utils/env.ts
/**
* Figures out if we're building a browser bundle.
*
* @returns true if this is a browser bundle build.
*/
function isBrowserBundle() {
	return typeof __SENTRY_BROWSER_BUNDLE__ !== "undefined" && !!__SENTRY_BROWSER_BUNDLE__;
}
/**
* Get source of SDK.
*/
function getSDKSource() {
	/*! __SENTRY_SDK_SOURCE__ */ return "npm";
}

// src/utils/node.ts
/**
* NOTE: In order to avoid circular dependencies, if you add a function to this module and it needs to print something,
* you must either a) use `console.log` rather than the `debug` singleton, or b) put your function elsewhere.
*/
/**
* Checks whether we're in the Node.js or Browser environment
*
* @returns Answer to given question
*/
function isNodeEnv() {
	return !isBrowserBundle() && Object.prototype.toString.call(typeof process !== "undefined" ? process : 0) === "[object process]";
}

// src/utils/isBrowser.ts
/**
* Returns true if we are in the browser.
*/
function isBrowser() {
	return typeof window !== "undefined" && (!isNodeEnv() || isElectronNodeRenderer());
}
function isElectronNodeRenderer() {
	return GLOBAL_OBJ.process?.type === "renderer";
}

/**
* Builds a span v2 container envelope item from already-serialized streamed spans.
*/
function createSpanContainerItem(serializedSpans, client) {
	const inferSetting = client.getDataCollectionOptions().userInfo ? "auto" : "never";
	return [{
		type: "span",
		item_count: serializedSpans.length,
		content_type: "application/vnd.sentry.items.span.v2+json"
	}, {
		version: 2,
		ingest_settings: isBrowser() ? {
			infer_ip: inferSetting,
			infer_user_agent: inferSetting
		} : void 0,
		items: serializedSpans
	}];
}

// src/utils/errorSpanAttribution.ts
/**
* The trace context of the span an error escaped, keyed by the error itself.
*
* We store the trace context rather than the span because that is the shape we apply to the event
* later, and it snapshots the span as it failed instead of reading it back once it has ended.
*/
const escapedSpanTraceContexts = /* @__PURE__ */ new WeakMap();
/**
* A `WeakMap` can only be keyed by an object, so an error thrown as a primitive (`throw 'boom'`)
* has nothing we can hang the span on and is left unattributed.
*/
function toWeakMapKey(error) {
	return isPrimitive(error) ? void 0 : error;
}
/**
* Attribute an error event to the span the error escaped, if we recorded one.
*
* This only applies within the error's own trace. The stored span id is meaningless in another
* trace, and the event's dynamic sampling context (which the envelope header is built from) is
* derived from the root span of the trace the event is already on. Rewriting the trace id here
* would leave the envelope header and body naming different traces.
*/
function applyEscapedErrorSpanToEvent(event, hint, scope) {
	const key = toWeakMapKey(hint.originalException);
	const traceContext = key && escapedSpanTraceContexts.get(key);
	if (!traceContext) return;
	const eventTraceContext = event.contexts?.trace;
	if ((eventTraceContext?.trace_id ?? (scope && getTraceContextFromScope(scope).trace_id)) !== traceContext.trace_id) return;
	event.contexts = {
		...event.contexts,
		trace: {
			...eventTraceContext,
			...traceContext
		}
	};
}

// src/envelope.ts
/**
* Apply SdkInfo (name, version, packages, integrations) to the corresponding event key.
* Merge with existing data if any.
*
* @internal, exported only for testing
**/
function _enhanceEventWithSdkInfo(event, newSdkInfo) {
	if (!newSdkInfo) return event;
	const eventSdkInfo = event.sdk || {};
	event.sdk = {
		...eventSdkInfo,
		name: eventSdkInfo.name || newSdkInfo.name,
		version: eventSdkInfo.version || newSdkInfo.version,
		integrations: [...event.sdk?.integrations || [], ...newSdkInfo.integrations || []],
		packages: [...event.sdk?.packages || [], ...newSdkInfo.packages || []],
		settings: event.sdk?.settings || newSdkInfo.settings ? {
			...event.sdk?.settings,
			...newSdkInfo.settings
		} : void 0
	};
	return event;
}
/** Creates an envelope from a Session */
function createSessionEnvelope(session, dsn, metadata, tunnel) {
	const sdkInfo = getSdkMetadataForEnvelopeHeader(metadata);
	const envelopeHeaders = {
		sent_at: new Date(safeDateNow()).toISOString(),
		...sdkInfo && { sdk: sdkInfo },
		...!!tunnel && dsn && { dsn: dsnToString(dsn) }
	};
	const envelopeItem = "aggregates" in session ? [{ type: "sessions" }, session] : [{ type: "session" }, session.toJSON()];
	return createEnvelope(envelopeHeaders, [envelopeItem]);
}
/**
* Create an Envelope from an event.
*/
function createEventEnvelope(event, dsn, metadata, tunnel) {
	const sdkInfo = getSdkMetadataForEnvelopeHeader(metadata);
	const eventType = event.type && event.type !== "replay_event" ? event.type : "event";
	_enhanceEventWithSdkInfo(event, metadata?.sdk);
	const envelopeHeaders = createEventEnvelopeHeaders(event, sdkInfo, tunnel, dsn);
	delete event.sdkProcessingMetadata;
	return createEnvelope(envelopeHeaders, [[{ type: eventType }, event]]);
}

// src/utils/data-collection/filtering-snippets.ts
const FILTERED_VALUE = "[Filtered]";
const SENSITIVE_KEY_SNIPPETS = [
	"auth",
	"token",
	"secret",
	"session",
	"password",
	"passwd",
	"pwd",
	"key",
	"jwt",
	"bearer",
	"sso",
	"saml",
	"csrf",
	"xsrf",
	"credentials",
	"sid",
	"identity",
	"set-cookie",
	"cookie"
];

// src/utils/data-collection/filterKeyValueData.ts
function isSensitiveKey(lower, denySnippets) {
	return denySnippets.some((snippet) => lower.includes(snippet));
}
function shouldFilterDataKey(key, behavior, additionalDenyTerms) {
	if (behavior === false) return true;
	const lowerKey = key.toLowerCase();
	if (isSensitiveKey(lowerKey, SENSITIVE_KEY_SNIPPETS)) return true;
	if (behavior === true) return false;
	const matchesConfiguredTerm = ("deny" in behavior ? behavior.deny : behavior.allow).some((term) => lowerKey.includes(term.toLowerCase()));
	return "deny" in behavior ? matchesConfiguredTerm : !matchesConfiguredTerm;
}
/**
* Filters a key-value record according to a `CollectBehavior`.
*
* Key names are always preserved. Values are either kept, replaced with
* `[Filtered]`, or the entire record is dropped (off mode).
*
* @param additionalDenyTerms - Additional sensitive snippets to check beyond the built-in denylist.
*/
function filterKeyValueData(data, behavior, additionalDenyTerms) {
	if (behavior === false) return {};
	const result = {};
	for (const key of Object.keys(data)) result[key] = shouldFilterDataKey(key, behavior) ? FILTERED_VALUE : data[key];
	return result;
}

// src/utils/syncpromise.ts
/** SyncPromise internal states */
const STATE_PENDING = 0;
const STATE_RESOLVED = 1;
const STATE_REJECTED = 2;
/**
* Creates a resolved sync promise.
*
* @param value the value to resolve the promise with
* @returns the resolved sync promise
*/
function resolvedSyncPromise(value) {
	return new SyncPromise((resolve) => {
		resolve(value);
	});
}
/**
* Creates a rejected sync promise.
*
* @param value the value to reject the promise with
* @returns the rejected sync promise
*/
function rejectedSyncPromise(reason) {
	return new SyncPromise((_, reject) => {
		reject(reason);
	});
}
/**
* Thenable class that behaves like a Promise and follows it's interface
* but is not async internally
*/
var SyncPromise = class SyncPromise {
	constructor(executor) {
		this._state = STATE_PENDING;
		this._handlers = [];
		this._runExecutor(executor);
	}
	/** @inheritdoc */
	then(onfulfilled, onrejected) {
		return new SyncPromise((resolve, reject) => {
			this._handlers.push([
				false,
				(result) => {
					if (!onfulfilled) resolve(result);
					else try {
						resolve(onfulfilled(result));
					} catch (e) {
						reject(e);
					}
				},
				(reason) => {
					if (!onrejected) reject(reason);
					else try {
						resolve(onrejected(reason));
					} catch (e) {
						reject(e);
					}
				}
			]);
			this._executeHandlers();
		});
	}
	/** @inheritdoc */
	catch(onrejected) {
		return this.then((val) => val, onrejected);
	}
	/** @inheritdoc */
	finally(onfinally) {
		return new SyncPromise((resolve, reject) => {
			let val;
			let isRejected;
			return this.then((value) => {
				isRejected = false;
				val = value;
				if (onfinally) onfinally();
			}, (reason) => {
				isRejected = true;
				val = reason;
				if (onfinally) onfinally();
			}).then(() => {
				if (isRejected) {
					reject(val);
					return;
				}
				resolve(val);
			});
		});
	}
	/** Excute the resolve/reject handlers. */
	_executeHandlers() {
		if (this._state === STATE_PENDING) return;
		const cachedHandlers = this._handlers.slice();
		this._handlers = [];
		cachedHandlers.forEach((handler) => {
			if (handler[0]) return;
			if (this._state === STATE_RESOLVED) handler[1](this._value);
			if (this._state === STATE_REJECTED) handler[2](this._value);
			handler[0] = true;
		});
	}
	/** Run the executor for the SyncPromise. */
	_runExecutor(executor) {
		const setResult = (state, value) => {
			if (this._state !== STATE_PENDING) return;
			if (isThenable(value)) {
				value.then(resolve, reject);
				return;
			}
			this._state = state;
			this._value = value;
			this._executeHandlers();
		};
		const resolve = (value) => {
			setResult(STATE_RESOLVED, value);
		};
		const reject = (reason) => {
			setResult(STATE_REJECTED, reason);
		};
		try {
			executor(resolve, reject);
		} catch (e) {
			reject(e);
		}
	}
};

// src/eventProcessors.ts
/**
* Process an array of event processors, returning the processed event (or `null` if the event was dropped).
*/
function notifyEventProcessors(processors, event, hint, index = 0, onDrop) {
	try {
		const result = _notifyEventProcessors(event, hint, processors, index, onDrop);
		return isThenable(result) ? result : resolvedSyncPromise(result);
	} catch (error) {
		return rejectedSyncPromise(error);
	}
}
function _notifyEventProcessors(event, hint, processors, index, onDrop) {
	const processor = processors[index];
	if (!event || !processor) return event;
	const processorName = `Event processor "${processor.id || "?"}"`;
	let callbackError = false;
	const result = safeCallback(DEBUG_BUILD$2 ? `${processorName} threw an error, dropping event:` : "", () => processor({ ...event }, hint), () => {
		callbackError = true;
		return null;
	});
	DEBUG_BUILD$2 && result === null && debug.log(`${processorName} dropped event`);
	if (isThenable(result)) return result.then((final) => {
		if (!final) {
			onDrop?.(callbackError ? "callback_error" : "event_processor");
			return null;
		}
		return _notifyEventProcessors(final, hint, processors, index + 1, onDrop);
	});
	if (!result) {
		onDrop?.(callbackError ? "callback_error" : "event_processor");
		return null;
	}
	return _notifyEventProcessors(result, hint, processors, index + 1, onDrop);
}

// src/utils/debug-ids.ts
let parsedStackResults;
let lastSentryKeysCount;
let lastNativeKeysCount;
let cachedFilenameDebugIds;
/**
* Returns a map of filenames to debug identifiers.
* Supports both proprietary _sentryDebugIds and native _debugIds (e.g., from Vercel) formats.
*/
function getFilenameToDebugIdMap(stackParser) {
	const sentryDebugIdMap = GLOBAL_OBJ._sentryDebugIds;
	const nativeDebugIdMap = GLOBAL_OBJ._debugIds;
	if (!sentryDebugIdMap && !nativeDebugIdMap) return {};
	const sentryDebugIdKeys = sentryDebugIdMap ? Object.keys(sentryDebugIdMap) : [];
	const nativeDebugIdKeys = nativeDebugIdMap ? Object.keys(nativeDebugIdMap) : [];
	if (cachedFilenameDebugIds && sentryDebugIdKeys.length === lastSentryKeysCount && nativeDebugIdKeys.length === lastNativeKeysCount) return cachedFilenameDebugIds;
	lastSentryKeysCount = sentryDebugIdKeys.length;
	lastNativeKeysCount = nativeDebugIdKeys.length;
	cachedFilenameDebugIds = {};
	if (!parsedStackResults) parsedStackResults = {};
	const processDebugIds = (debugIdKeys, debugIdMap) => {
		for (const key of debugIdKeys) {
			const debugId = debugIdMap[key];
			const result = parsedStackResults?.[key];
			if (result && cachedFilenameDebugIds && debugId) {
				cachedFilenameDebugIds[result[0]] = debugId;
				if (parsedStackResults) parsedStackResults[key] = [result[0], debugId];
			} else if (debugId) {
				const parsedStack = stackParser(key);
				for (let i = parsedStack.length - 1; i >= 0; i--) {
					const filename = parsedStack[i]?.filename;
					if (filename && cachedFilenameDebugIds && parsedStackResults) {
						cachedFilenameDebugIds[filename] = debugId;
						parsedStackResults[key] = [filename, debugId];
						break;
					}
				}
			}
		}
	};
	if (sentryDebugIdMap) processDebugIds(sentryDebugIdKeys, sentryDebugIdMap);
	if (nativeDebugIdMap) processDebugIds(nativeDebugIdKeys, nativeDebugIdMap);
	return cachedFilenameDebugIds;
}

// src/utils/eventUtils.ts
function isInternalException(hint) {
	return hint.data?.__sentry__ === true;
}
/**
* Get a list of possible event messages from a Sentry event.
*/
function getPossibleEventMessages(event) {
	const possibleMessages = [];
	if (event.message) possibleMessages.push(event.message);
	try {
		const lastException = event.exception.values[event.exception.values.length - 1];
		if (lastException?.value) {
			possibleMessages.push(lastException.value);
			if (lastException.type) possibleMessages.push(`${lastException.type}: ${lastException.value}`);
		}
	} catch {}
	return possibleMessages;
}

// src/utils/prepareEvent.ts
/**
* Adds common information to events.
*
* The information includes release and environment from `options`,
* breadcrumbs and context (extra, tags and user) from the scope.
*
* Information that is already present in the event is never overwritten. For
* nested objects, such as the context, keys are merged.
*
* @param event The original event.
* @param hint May contain additional information about the original exception.
* @param scope A scope containing event metadata.
* @returns A new event with more information, or `null` if an event processor dropped it (or threw). In that case the
*   drop has already been recorded on the client, so callers must not record it again.
* @hidden
*/
function prepareEvent(options, event, hint, scope, client, isolationScope) {
	const { normalizeDepth = 3, normalizeMaxBreadth = 1e3 } = options;
	const prepared = {
		...event,
		event_id: event.event_id || hint.event_id || uuid4(),
		timestamp: event.timestamp || dateTimestampInSeconds()
	};
	const integrations = hint.integrations || options.integrations.map((i) => i.name);
	applyClientOptions(prepared, options);
	applyIntegrationsMetadata(prepared, integrations);
	if (client) client.emit("applyFrameMetadata", event);
	if (event.type === void 0) applyDebugIds(prepared, options.stackParser);
	const finalScope = getFinalScope(scope, hint.captureContext);
	if (hint.mechanism) addExceptionMechanismToCapturedException(prepared, hint.mechanism);
	const clientEventProcessors = client ? client.getEventProcessors() : [];
	const data = getCombinedScopeData(isolationScope, finalScope);
	const attachments = [...hint.attachments || [], ...data.attachments];
	if (attachments.length) hint.attachments = attachments;
	applyScopeDataToEvent(prepared, data);
	const span = getActiveSpan(finalScope);
	if (span) applySpanToEvent(prepared, span);
	applyEscapedErrorSpanToEvent(prepared, hint, finalScope);
	const eventProcessors = [...clientEventProcessors, ...data.eventProcessors];
	const isTransaction = event.type === "transaction";
	const spanCountBeforeProcessing = event.spans?.length || 0;
	return (isInternalException(hint) ? resolvedSyncPromise(prepared) : notifyEventProcessors(eventProcessors, prepared, hint, 0, (reason) => {
		if (!client) return;
		client.recordDroppedEvent(reason, getDataCategoryByType(event.type));
		if (isTransaction) client.recordDroppedEvent(reason, "span", 1 + spanCountBeforeProcessing);
	})).then((evt) => {
		if (!evt) return null;
		if (isTransaction && client) {
			const droppedSpanCount = spanCountBeforeProcessing - (evt.spans?.length || 0);
			if (droppedSpanCount > 0) client.recordDroppedEvent("event_processor", "span", droppedSpanCount);
		}
		applyDebugMeta(evt);
		if (typeof normalizeDepth === "number" && normalizeDepth > 0) return normalizeEvent(evt, normalizeDepth, normalizeMaxBreadth);
		return evt;
	});
}
/**
* Enhances event using the client configuration.
* It takes care of all "static" values like environment, release and `dist`,
* as well as truncating overly long values.
*
* Only exported for tests.
*
* @param event event instance to be enhanced
*/
function applyClientOptions(event, options) {
	const { environment, release, dist, maxValueLength } = options;
	event.environment = event.environment || environment || "production";
	if (!event.release && release) event.release = release;
	if (!event.dist && dist) event.dist = dist;
	const request = event.request;
	if (request?.url && maxValueLength) request.url = truncate(request.url, maxValueLength);
	if (maxValueLength) event.exception?.values?.forEach((exception) => {
		if (exception.value) exception.value = truncate(exception.value, maxValueLength);
	});
}
/**
* Puts debug IDs into the stack frames of an error event.
*/
function applyDebugIds(event, stackParser) {
	const filenameDebugIdMap = getFilenameToDebugIdMap(stackParser);
	event.exception?.values?.forEach((exception) => {
		exception.stacktrace?.frames?.forEach((frame) => {
			if (frame.filename) frame.debug_id = filenameDebugIdMap[frame.filename];
		});
	});
}
/**
* Moves debug IDs from the stack frames of an error event into the debug_meta field.
*/
function applyDebugMeta(event) {
	const filenameDebugIdMap = {};
	event.exception?.values?.forEach((exception) => {
		exception.stacktrace?.frames?.forEach((frame) => {
			if (frame.debug_id) {
				if (frame.abs_path) filenameDebugIdMap[frame.abs_path] = frame.debug_id;
				else if (frame.filename) filenameDebugIdMap[frame.filename] = frame.debug_id;
				delete frame.debug_id;
			}
		});
	});
	if (Object.keys(filenameDebugIdMap).length === 0) return;
	event.debug_meta = event.debug_meta || {};
	event.debug_meta.images = event.debug_meta.images || [];
	const images = event.debug_meta.images;
	Object.entries(filenameDebugIdMap).forEach(([filename, debug_id]) => {
		images.push({
			type: "sourcemap",
			code_file: filename,
			debug_id
		});
	});
}
/**
* This function adds all used integrations to the SDK info in the event.
* @param event The event that will be filled with all integrations.
*/
function applyIntegrationsMetadata(event, integrationNames) {
	if (integrationNames.length > 0) {
		event.sdk = event.sdk || {};
		event.sdk.integrations = [...event.sdk.integrations || [], ...integrationNames];
	}
}
/**
* Applies `normalize` function on necessary `Event` attributes to make them safe for serialization.
* Normalized keys:
* - `breadcrumbs.data`
* - `user`
* - `contexts`
* - `extra`
* @param event Event
* @returns Normalized event
*/
function normalizeEvent(event, depth, maxBreadth) {
	if (!event) return null;
	const normalized = {
		...event,
		...event.breadcrumbs && { breadcrumbs: event.breadcrumbs.map((b) => ({
			...b,
			...b.data && { data: normalize(b.data, depth, maxBreadth) }
		})) },
		...event.user && { user: normalize(event.user, depth, maxBreadth) },
		...event.contexts && { contexts: normalize(event.contexts, depth, maxBreadth) },
		...event.extra && { extra: normalize(event.extra, depth, maxBreadth) }
	};
	if (event.contexts?.trace && normalized.contexts) {
		normalized.contexts.trace = event.contexts.trace;
		if (event.contexts.trace.data) normalized.contexts.trace.data = normalize(event.contexts.trace.data, depth, maxBreadth);
	}
	if (event.spans) normalized.spans = event.spans.map((span) => {
		return {
			...span,
			...span.data && { data: normalize(span.data, depth, maxBreadth) }
		};
	});
	if (event.contexts?.flags && normalized.contexts) normalized.contexts.flags = normalize(event.contexts.flags, 3, maxBreadth);
	return normalized;
}
function getFinalScope(scope, captureContext) {
	if (!captureContext) return scope;
	const finalScope = scope ? scope.clone() : new Scope();
	finalScope.update(captureContext);
	return finalScope;
}
/**
* Parse either an `EventHint` directly, or convert a `CaptureContext` to an `EventHint`.
* This is used to allow to update method signatures that used to accept a `CaptureContext` but should now accept an `EventHint`.
*/
function parseEventHintOrCaptureContext(hint) {
	return;
}

// src/exports.ts
/**
* Captures an exception event and sends it to Sentry.
*
* @param exception The exception to capture.
* @param hint Optional additional data to attach to the Sentry event.
* @returns the id of the captured Sentry event.
*/
function captureException(exception, hint) {
	return getCurrentScope().captureException(exception, parseEventHintOrCaptureContext());
}
/**
* Captures a message event and sends it to Sentry.
*
* @param message The message to send to Sentry.
* @param captureContext Define the level of the message or pass in additional data to attach to the message.
* @returns the id of the captured message.
*/
function captureMessage(message, captureContext) {
	const level = typeof captureContext === "string" ? captureContext : void 0;
	const hint = typeof captureContext !== "string" ? { captureContext } : void 0;
	return getCurrentScope().captureMessage(message, level, hint);
}
/**
* Captures a manually created event and sends it to Sentry.
*
* @param event The event to send to Sentry.
* @param hint Optional additional data to attach to the Sentry event.
* @returns the id of the captured event.
*/
function captureEvent(event, hint) {
	return getCurrentScope().captureEvent(event, hint);
}
/**
* Set key:value that will be sent as tags data with the event.
*
* Can also be used to unset a tag, by passing `undefined`.
*
* @param key String key of tag
* @param value Value of tag
*/
function setTag(key, value) {
	getIsolationScope().setTag(key, value);
}
/**
* Call `flush()` on the current client, if there is one. See {@link Client.flush}.
*
* @param timeout Maximum time in ms the client should wait to flush its event queue. Omitting this parameter will cause
* the client to wait until all events are sent before resolving the promise.
* @returns A promise which resolves to `true` if the queue successfully drains before the timeout, or `false` if it
* doesn't (or if there's no client defined).
*/
async function flush(timeout) {
	const client = getClient();
	if (client) return client.flush(timeout);
	DEBUG_BUILD$2 && debug.warn("Cannot flush events. No client defined.");
	return Promise.resolve(false);
}
/**
* Start a session on the current isolation scope.
*
* @param context (optional) additional properties to be applied to the returned session object
*
* @returns the new active session
*/
function startSession(context) {
	const isolationScope = getIsolationScope();
	const { user } = getCombinedScopeData(isolationScope, getCurrentScope());
	let userAgent = GLOBAL_OBJ.navigator?.userAgent;
	if (userAgent) {
		const headerCollection = getClient()?.getDataCollectionOptions().httpHeaders.request ?? true;
		userAgent = filterKeyValueData({ "User-Agent": userAgent }, headerCollection)["User-Agent"];
	}
	const session = makeSession({
		user,
		userAgent,
		...context
	});
	const currentSession = isolationScope.getSession();
	if (currentSession?.status === "ok") updateSession(currentSession, { status: "exited" });
	endSession();
	isolationScope.setSession(session);
	return session;
}
/**
* End the session on the current isolation scope.
*/
function endSession() {
	const isolationScope = getIsolationScope();
	const session = getCurrentScope().getSession() || isolationScope.getSession();
	if (session) closeSession(session);
	_sendSessionUpdate();
	isolationScope.setSession();
}
/**
* Sends the current Session on the scope
*/
function _sendSessionUpdate() {
	const isolationScope = getIsolationScope();
	const client = getClient();
	const session = isolationScope.getSession();
	if (session && client) client.captureSession(session);
}
/**
* Sends the current session on the scope to Sentry
*
* @param end If set the session will be marked as exited and removed from the scope.
*            Defaults to `false`.
*/
function captureSession(end = false) {
	if (end) {
		endSession();
		return;
	}
	_sendSessionUpdate();
}

/** Returns the prefix to construct Sentry ingestion API endpoints. */
function getBaseApiEndpoint(dsn) {
	const protocol = dsn.protocol ? `${dsn.protocol}:` : "";
	const port = dsn.port ? `:${dsn.port}` : "";
	return `${protocol}//${dsn.host}${port}${dsn.path ? `/${dsn.path}` : ""}/api/`;
}
/** Returns the ingest API endpoint for target. */
function _getIngestEndpoint(dsn) {
	return `${getBaseApiEndpoint(dsn)}${dsn.projectId}/envelope/`;
}
/** Returns a URL-encoded string with auth config suitable for a query string. */
function _encodedAuth(dsn, sdkInfo) {
	const params = { sentry_version: "7" };
	if (dsn.publicKey) params.sentry_key = dsn.publicKey;
	if (sdkInfo) params.sentry_client = `${sdkInfo.name}/${sdkInfo.version}`;
	return new URLSearchParams(params).toString();
}
/**
* Returns the envelope endpoint URL with auth in the query string.
*
* Sending auth as part of the query string and not as custom HTTP headers avoids CORS preflight requests.
*/
function getEnvelopeEndpointWithUrlEncodedAuth(dsn, tunnel, sdkInfo) {
	return tunnel ? tunnel : `${_getIngestEndpoint(dsn)}?${_encodedAuth(dsn, sdkInfo)}`;
}

// src/tracing/spans/extractGenAiSpans.ts
/**
* Extracts gen_ai spans from a transaction event, converts them to span v2 format,
* and returns them as a SpanContainerItem.
*
* Only applies to static mode (non-streaming) transactions.
*
* WARNING: This function mutates `event.spans` by removing the extracted gen_ai spans
* from the array. Call this before creating the event envelope so the transaction
* item does not include the extracted spans.
*/
function extractGenAiSpansFromEvent(event, client) {
	if (event.type !== "transaction" || !event.spans?.length || !event.sdkProcessingMetadata?.hasGenAiSpans || hasSpanStreamingEnabled(client)) return;
	const genAiSpans = [];
	const remainingSpans = [];
	for (const span of event.spans) if (span.op?.startsWith("gen_ai.")) genAiSpans.push(spanJsonToSerializedStreamedSpan(span));
	else remainingSpans.push(span);
	if (genAiSpans.length === 0) return;
	event.spans = remainingSpans;
	return createSpanContainerItem(genAiSpans, client);
}

// src/utils/promisebuffer.ts
const SENTRY_BUFFER_FULL_ERROR = Symbol.for("SentryBufferFullError");
/**
* Creates an new PromiseBuffer object with the specified limit
* @param limit max number of promises that can be stored in the buffer
*/
function makePromiseBuffer(limit = 100) {
	const buffer = /* @__PURE__ */ new Set();
	function isReady() {
		return buffer.size < limit;
	}
	/**
	* Remove a promise from the queue.
	*
	* @param task Can be any PromiseLike<T>
	* @returns Removed promise.
	*/
	function remove(task) {
		buffer.delete(task);
	}
	/**
	* Add a promise (representing an in-flight action) to the queue, and set it to remove itself on fulfillment.
	*
	* @param taskProducer A function producing any PromiseLike<T>; In previous versions this used to be `task:
	*        PromiseLike<T>`, but under that model, Promises were instantly created on the call-site and their executor
	*        functions therefore ran immediately. Thus, even if the buffer was full, the action still happened. By
	*        requiring the promise to be wrapped in a function, we can defer promise creation until after the buffer
	*        limit check.
	* @returns The original promise.
	*/
	function add(taskProducer) {
		if (!isReady()) return rejectedSyncPromise(SENTRY_BUFFER_FULL_ERROR);
		const task = taskProducer();
		buffer.add(task);
		task.then(() => remove(task), () => remove(task));
		return task;
	}
	/**
	* Wait for all promises in the queue to resolve or for timeout to expire, whichever comes first.
	*
	* @param timeout The time, in ms, after which to resolve to `false` if the queue is still non-empty. Passing `0` (or
	* not passing anything) will make the promise wait as long as it takes for the queue to drain before resolving to
	* `true`.
	* @returns A promise which will resolve to `true` if the queue is already empty or drains before the timeout, and
	* `false` otherwise
	*/
	function drain(timeout) {
		if (!buffer.size) return resolvedSyncPromise(true);
		const drainPromise = Promise.allSettled(Array.from(buffer)).then(() => true);
		if (!timeout) return drainPromise;
		const promises = [drainPromise, new Promise((resolve) => safeUnref(setTimeout(() => resolve(false), timeout)))];
		return Promise.race(promises);
	}
	return {
		get $() {
			return Array.from(buffer);
		},
		add,
		drain
	};
}

// src/utils/ratelimit.ts
const DEFAULT_RETRY_AFTER = 6e4;
/**
* Extracts Retry-After value from the request header or returns default value
* @param header string representation of 'Retry-After' header
* @param now current unix timestamp
*
*/
function parseRetryAfterHeader(header, now = safeDateNow()) {
	const headerDelay = parseInt(`${header}`, 10);
	if (!isNaN(headerDelay)) return headerDelay * 1e3;
	const headerDate = Date.parse(`${header}`);
	if (!isNaN(headerDate)) return headerDate - now;
	return DEFAULT_RETRY_AFTER;
}
/**
* Gets the time that the given category is disabled until for rate limiting.
* In case no category-specific limit is set but a general rate limit across all categories is active,
* that time is returned.
*
* @return the time in ms that the category is disabled until or 0 if there's no active rate limit.
*/
function disabledUntil(limits, dataCategory) {
	return limits[dataCategory] || limits.all || 0;
}
/**
* Checks if a category is rate limited
*/
function isRateLimited(limits, dataCategory, now = safeDateNow()) {
	return disabledUntil(limits, dataCategory) > now;
}
/**
* Update ratelimits from incoming headers.
*
* @return the updated RateLimits object.
*/
function updateRateLimits(limits, response, now = safeDateNow()) {
	const updatedRateLimits = { ...limits };
	forEachRateLimit(response, now, (category, until) => {
		updatedRateLimits[category] = Math.max(updatedRateLimits[category] || 0, until);
	});
	return updatedRateLimits;
}
/**
* Calls `extendRateLimit` with the category and deadline of each rate limit in the response.
*/
function forEachRateLimit({ statusCode, headers }, now, extendRateLimit) {
	const rateLimitHeader = headers?.["x-sentry-rate-limits"];
	const retryAfterHeader = headers?.["retry-after"];
	if (rateLimitHeader)
 /**
	* rate limit headers are of the form
	*     <header>,<header>,..
	* where each <header> is of the form
	*     <retry_after>: <categories>: <scope>: <reason_code>: <namespaces>
	* where
	*     <retry_after> is a delay in seconds
	*     <categories> is the event type(s) (error, transaction, etc) being rate limited and is of the form
	*         <category>;<category>;...
	*     <scope> is what's being limited (org, project, or key) - ignored by SDK
	*     <reason_code> is an arbitrary string like "org_quota" - ignored by SDK
	*     <namespaces> Semicolon-separated list of metric namespace identifiers. Defines which namespace(s) will be affected.
	*         Only present if rate limit applies to the metric_bucket data category.
	*/
	for (const limit of rateLimitHeader.trim().split(",")) {
		const [retryAfter, categories, , , namespaces] = limit.split(":", 5);
		const headerDelay = parseInt(retryAfter, 10);
		const delay = (!isNaN(headerDelay) ? headerDelay : 60) * 1e3;
		if (!categories) extendRateLimit("all", now + delay);
		else for (const category of categories.split(";")) if (category === "metric_bucket") {
			if (!namespaces || namespaces.split(";").includes("custom")) extendRateLimit(category, now + delay);
		} else extendRateLimit(category, now + delay);
	}
	else if (retryAfterHeader) extendRateLimit("all", now + parseRetryAfterHeader(retryAfterHeader, now));
	else if (statusCode === 429) extendRateLimit("all", now + 6e4);
}

/**
* Creates an instance of a Sentry `Transport`
*
* @param options
* @param makeRequest
*/
function createTransport(options, makeRequest, buffer = makePromiseBuffer(options.bufferSize || 64)) {
	let rateLimits = {};
	const flush = (timeout) => buffer.drain(timeout);
	function recordItemLoss(reason, [headers, payload], type) {
		const dataCategory = envelopeItemTypeToDataCategory(type);
		if (type === "transaction") options.recordDroppedEvent(reason, "span", (payload.spans?.length ?? 0) + 1);
		options.recordDroppedEvent(reason, dataCategory, typeof headers.item_count === "number" ? headers.item_count : 1);
	}
	function send(envelope) {
		const filteredEnvelopeItems = [];
		forEachEnvelopeItem(envelope, (item, type) => {
			if (isRateLimited(rateLimits, envelopeItemTypeToDataCategory(type))) recordItemLoss("ratelimit_backoff", item, type);
			else filteredEnvelopeItems.push(item);
		});
		if (filteredEnvelopeItems.length === 0) return Promise.resolve({});
		const filteredEnvelope = createEnvelope(envelope[0], filteredEnvelopeItems);
		const recordEnvelopeLoss = (reason) => {
			if (envelopeContainsItemType(filteredEnvelope, ["client_report"])) {
				DEBUG_BUILD$2 && debug.warn(`Dropping client report. Will not send outcomes (reason: ${reason}).`);
				return;
			}
			forEachEnvelopeItem(filteredEnvelope, (item, type) => {
				recordItemLoss(reason, item, type);
			});
		};
		const requestTask = () => makeRequest({ body: serializeEnvelope(filteredEnvelope) }).then((response) => {
			if (response.statusCode === 413) {
				DEBUG_BUILD$2 && debug.error("Sentry responded with status code 413. Envelope was discarded due to exceeding size limits.");
				recordEnvelopeLoss("send_error");
				return response;
			}
			if (DEBUG_BUILD$2 && response.statusCode !== void 0 && (response.statusCode < 200 || response.statusCode >= 300)) debug.warn(`Sentry responded with status code ${response.statusCode} to sent event.`);
			rateLimits = updateRateLimits(rateLimits, response);
			return response;
		}, (error) => {
			recordEnvelopeLoss("network_error");
			DEBUG_BUILD$2 && debug.error("Encountered error running transport request:", error);
			throw error;
		});
		return buffer.add(requestTask).then((result) => result, (error) => {
			if (error === SENTRY_BUFFER_FULL_ERROR) {
				DEBUG_BUILD$2 && debug.error("Skipped sending event because buffer is full.");
				recordEnvelopeLoss("queue_overflow");
				return Promise.resolve({});
			} else throw error;
		});
	}
	return {
		send,
		flush
	};
}

// src/utils/clientreport.ts
/**
* Creates client report envelope
* @param discarded_events An array of discard events
* @param dsn A DSN that can be set on the header. Optional.
*/
function createClientReportEnvelope(discarded_events, dsn, timestamp) {
	const clientReportItem = [{ type: "client_report" }, {
		timestamp: dateTimestampInSeconds(),
		discarded_events
	}];
	return createEnvelope(dsn ? { dsn } : {}, [clientReportItem]);
}

// src/utils/transactionEvent.ts
/**
* Converts a transaction event to a span JSON object.
*/
function convertTransactionEventToSpanJson(event) {
	const { trace_id, parent_span_id, span_id, status, origin, data, op, links } = event.contexts?.trace ?? {};
	return {
		data: data ?? {},
		description: event.transaction,
		op,
		parent_span_id,
		span_id: span_id ?? "",
		start_timestamp: event.start_timestamp ?? 0,
		status: status ?? "ok",
		timestamp: event.timestamp,
		trace_id: trace_id ?? "",
		origin,
		links,
		profile_id: data?.[kb],
		exclusive_time: data?.[Wm],
		measurements: event.measurements,
		is_segment: true
	};
}
/**
* Converts a span JSON object to a transaction event.
*/
function convertSpanJsonToTransactionEvent(span) {
	return {
		type: "transaction",
		timestamp: span.timestamp,
		start_timestamp: span.start_timestamp,
		transaction: span.description,
		contexts: { trace: {
			trace_id: span.trace_id,
			span_id: span.span_id,
			parent_span_id: span.parent_span_id,
			op: span.op,
			status: span.status,
			origin: span.origin,
			links: span.links,
			data: {
				...span.data,
				...span.profile_id && { [kb]: span.profile_id },
				...span.exclusive_time && { [Wm]: span.exclusive_time }
			}
		} },
		measurements: span.measurements
	};
}

// src/utils/warnAboutIgnoredTransactionOptions.ts
/**
* Warns about `beforeSendTransaction` and `ignoreTransactions` being ignored because span streaming is enabled.
*
* Both options are tied to the transaction event that span streaming no longer produces, so they silently
* stop taking effect when users upgrade. Since that's easy to miss, this warning bypasses the `debug` logger
* (which is opt-in and stripped from non-debug bundles) and writes to the console directly.
*/
function maybeWarnAboutIgnoredTransactionOptions(options) {
	if (options.traceLifecycle !== "stream" || !(options.beforeSendTransaction || options.ignoreTransactions?.length)) return;
	consoleSandbox(() => {
		console.warn("[Sentry] `beforeSendTransaction` and `ignoreTransactions` are ignored with `traceLifecycle: 'stream'` (enabled by default). Use `beforeSendSpan` and `ignoreSpans` instead, or set `traceLifecycle: 'static'`.");
	});
}

// src/utils/data-collection/resolveDataCollectionOptions.ts
const DEFAULTS = {
	userInfo: true,
	cookies: true,
	httpHeaders: {
		request: true,
		response: true
	},
	httpBodies: [
		"incomingRequest",
		"outgoingRequest",
		"incomingResponse",
		"outgoingResponse"
	],
	urlQueryParams: true,
	graphQL: {
		document: true,
		variables: true
	},
	genAI: {
		inputs: true,
		outputs: true
	},
	mcp: {
		inputs: true,
		outputs: true
	},
	databaseQueryData: true,
	queues: true,
	stackFrameVariables: true,
	frameContextLines: 5
};
function isCollectBehavior(value) {
	return typeof value === "boolean" || "allow" in value || "deny" in value;
}
function resolveHttpHeaders(httpHeaders) {
	if (httpHeaders === void 0) return { ...DEFAULTS.httpHeaders };
	if (isCollectBehavior(httpHeaders)) return {
		request: httpHeaders,
		response: httpHeaders
	};
	return {
		request: httpHeaders.request ?? DEFAULTS.httpHeaders.request,
		response: httpHeaders.response ?? DEFAULTS.httpHeaders.response
	};
}
/**
* Resolves the effective `DataCollection` configuration from client options.
*
* Precedence:
* 1. Spec defaults
* 2. Fields explicitly set in `dataCollection`
*/
function resolveDataCollectionOptions(options) {
	const dc = options.dataCollection ?? {};
	return {
		userInfo: dc.userInfo ?? DEFAULTS.userInfo,
		cookies: dc.cookies ?? DEFAULTS.cookies,
		httpHeaders: resolveHttpHeaders(dc.httpHeaders),
		httpBodies: dc.httpBodies ?? DEFAULTS.httpBodies,
		urlQueryParams: dc.urlQueryParams ?? DEFAULTS.urlQueryParams,
		graphQL: {
			document: dc.graphQL?.document ?? DEFAULTS.graphQL.document,
			variables: dc.graphQL?.variables ?? DEFAULTS.graphQL.variables
		},
		genAI: {
			inputs: dc.genAI?.inputs ?? DEFAULTS.genAI.inputs,
			outputs: dc.genAI?.outputs ?? DEFAULTS.genAI.outputs
		},
		mcp: {
			inputs: dc.mcp?.inputs ?? DEFAULTS.mcp.inputs,
			outputs: dc.mcp?.outputs ?? DEFAULTS.mcp.outputs
		},
		databaseQueryData: dc.databaseQueryData ?? DEFAULTS.databaseQueryData,
		queues: dc.queues ?? DEFAULTS.queues,
		stackFrameVariables: dc.stackFrameVariables ?? DEFAULTS.stackFrameVariables,
		frameContextLines: dc.frameContextLines ?? DEFAULTS.frameContextLines
	};
}

// src/client.ts
const ALREADY_SEEN_ERROR = "Not capturing exception because it's already been captured.";
const MISSING_RELEASE_FOR_SESSION_ERROR = "Discarded session because of missing or non-string release";
const INTERNAL_ERROR_SYMBOL = Symbol.for("SentryInternalError");
const DO_NOT_SEND_EVENT_SYMBOL = Symbol.for("SentryDoNotSendEventError");
const CLOSED_CLIENT_SYMBOL = Symbol.for("SentryClosedClient");
/**
* Whether `close()` was called on the given client.
*
* @hidden
*/
function isClientClosed(client) {
	return CLOSED_CLIENT_SYMBOL in client;
}
function _makeInternalError(message) {
	return {
		message,
		[INTERNAL_ERROR_SYMBOL]: true
	};
}
function _makeDoNotSendEventError(message) {
	return {
		message,
		[DO_NOT_SEND_EVENT_SYMBOL]: true
	};
}
function _makeSampledOutError(sampleRate) {
	return _makeDoNotSendEventError(`Discarding event because it's not included in the random sample (sampling rate = ${sampleRate})`);
}
function _isInternalError(error) {
	return isObjectLike(error) && INTERNAL_ERROR_SYMBOL in error;
}
function _isDoNotSendEventError(error) {
	return isObjectLike(error) && DO_NOT_SEND_EVENT_SYMBOL in error;
}
/**
* Base implementation for all JavaScript SDK clients.
*
* Call the constructor with the corresponding options
* specific to the client subclass. To access these options later, use
* {@link Client.getOptions}.
*
* If a Dsn is specified in the options, it will be parsed and stored. Use
* {@link Client.getDsn} to retrieve the Dsn at any moment. In case the Dsn is
* invalid, the constructor will throw a {@link SentryException}. Note that
* without a valid Dsn, the SDK will not send any events to Sentry.
*
* Before sending an event, it is passed through
* {@link Client._prepareEvent} to add SDK information and scope data
* (breadcrumbs and context). To add more custom information, override this
* method and extend the resulting prepared event.
*
* To issue automatically created events (e.g. via instrumentation), use
* {@link Client.captureEvent}. It will prepare the event and pass it through
* the callback lifecycle. To issue auto-breadcrumbs, use
* {@link Client.addBreadcrumb}.
*
* @example
* class NodeClient extends Client<NodeOptions> {
*   public constructor(options: NodeOptions) {
*     super(options);
*   }
*
*   // ...
* }
*/
var Client = class {
	/**
	* Initializes this client instance.
	*
	* @param options Options for the client.
	*/
	constructor(options) {
		this._options = {
			attachStacktrace: true,
			...options,
			traceLifecycle: options.traceLifecycle === "static" ? "static" : "stream"
		};
		this._integrations = {};
		this._numProcessing = 0;
		this._outcomes = {};
		this._hooks = {};
		this._eventProcessors = [];
		this._promiseBuffer = makePromiseBuffer(options.transportOptions?.bufferSize ?? 64);
		this._dataCollection = resolveDataCollectionOptions(options);
		this._unhandledSessionStatus = "crashed";
		this._attachStacktraceIsDefault = options.attachStacktrace === void 0;
		if (options.dsn) this._dsn = makeDsn(options.dsn);
		else DEBUG_BUILD$2 && debug.warn("No DSN provided, client will not send events.");
		const { beforeSendSpan, traceLifecycle } = this._options;
		if (DEBUG_BUILD$2 && beforeSendSpan && isStaticBeforeSendSpanCallback(beforeSendSpan) !== (traceLifecycle === "static")) consoleSandbox(() => {
			console.warn(`Ignoring \`beforeSendSpan\`: ${traceLifecycle === "static" ? "wrap it with" : "remove"} \`Sentry.withStaticSpan\` to use it with \`traceLifecycle: "${traceLifecycle}"\`.`);
		});
		if (this._dsn) {
			const url = getEnvelopeEndpointWithUrlEncodedAuth(this._dsn, options.tunnel, options._metadata ? options._metadata.sdk : void 0);
			this._transport = options.transport({
				tunnel: this._options.tunnel,
				recordDroppedEvent: this.recordDroppedEvent.bind(this),
				...options.transportOptions,
				url
			});
		}
	}
	/**
	* Captures an exception event and sends it to Sentry.
	*
	* Unlike `captureException` exported from every SDK, this method requires that you pass it the current scope.
	*/
	captureException(exception, hint, scope) {
		const eventId = uuid4();
		if (checkOrSetAlreadyCaught(exception)) {
			DEBUG_BUILD$2 && debug.log(ALREADY_SEEN_ERROR);
			return eventId;
		}
		const hintWithEventId = {
			event_id: eventId,
			...hint
		};
		this._process(() => this.eventFromException(exception, hintWithEventId).then((event) => this._captureEvent(event, hintWithEventId, scope)).then((res) => res), "error");
		return hintWithEventId.event_id;
	}
	/**
	* Captures a message event and sends it to Sentry.
	*
	* Unlike `captureMessage` exported from every SDK, this method requires that you pass it the current scope.
	*/
	captureMessage(message, level, hint, currentScope) {
		const hintWithEventId = {
			event_id: uuid4(),
			...hint
		};
		const eventMessage = isParameterizedString(message) ? message : String(message);
		const isMessage = isPrimitive(message);
		const promisedEvent = isMessage ? this.eventFromMessage(eventMessage, level, hintWithEventId).then((event) => {
			if (event.exception && this._attachStacktraceIsDefault) event.sdkProcessingMetadata = {
				...event.sdkProcessingMetadata,
				hasDefaultSyntheticStacktrace: true
			};
			return event;
		}) : this.eventFromException(message, hintWithEventId);
		this._process(() => promisedEvent.then((event) => this._captureEvent(event, hintWithEventId, currentScope)), isMessage ? "unknown" : "error");
		return hintWithEventId.event_id;
	}
	/**
	* Captures a manually created event and sends it to Sentry.
	*
	* Unlike `captureEvent` exported from every SDK, this method requires that you pass it the current scope.
	*/
	captureEvent(event, hint, currentScope) {
		const eventId = uuid4();
		if (hint?.originalException && checkOrSetAlreadyCaught(hint.originalException)) {
			DEBUG_BUILD$2 && debug.log(ALREADY_SEEN_ERROR);
			return eventId;
		}
		const hintWithEventId = {
			event_id: eventId,
			...hint
		};
		const sdkProcessingMetadata = event.sdkProcessingMetadata || {};
		const capturedSpanScope = sdkProcessingMetadata.capturedSpanScope;
		const capturedSpanIsolationScope = sdkProcessingMetadata.capturedSpanIsolationScope;
		const dataCategory = getDataCategoryByType(event.type);
		this._process(() => this._captureEvent(event, hintWithEventId, capturedSpanScope || currentScope, capturedSpanIsolationScope), dataCategory);
		return hintWithEventId.event_id;
	}
	/**
	* Captures a session.
	*/
	captureSession(session) {
		this.sendSession(session);
		updateSession(session, { init: false });
	}
	/**
	* Get the current Dsn.
	*/
	getDsn() {
		return this._dsn;
	}
	/**
	* Get the current options.
	*/
	getOptions() {
		return this._options;
	}
	/**
	* Get the resolved data collection configuration.
	*/
	getDataCollectionOptions() {
		return this._dataCollection;
	}
	/**
	* Get the SDK metadata.
	* @see SdkMetadata
	*/
	getSdkMetadata() {
		return this._options._metadata;
	}
	/**
	* Returns the transport that is used by the client.
	* Please note that the transport gets lazy initialized so it will only be there once the first event has been sent.
	*/
	getTransport() {
		return this._transport;
	}
	/**
	* Wait for all events to be sent or the timeout to expire, whichever comes first.
	*
	* @param timeout Maximum time in ms the client should wait for events to be flushed. Omitting this parameter will
	*   cause the client to wait until all events are sent before resolving the promise.
	* @returns A promise that will resolve with `true` if all events are sent before the timeout, or `false` if there are
	* still events in the queue when the timeout is reached.
	*/
	async flush(timeout) {
		const transport = this._transport;
		this.emit("flush");
		if (!transport) return true;
		const clientFinished = await this._isClientDoneProcessing(timeout);
		const transportFlushed = await transport.flush(timeout);
		return clientFinished && transportFlushed;
	}
	/**
	* Flush the event queue and set the client to `enabled = false`. See {@link Client.flush}.
	*
	* @param {number} timeout Maximum time in ms the client should wait before shutting down. Omitting this parameter will cause
	*   the client to wait until all events are sent before disabling itself.
	* @returns {Promise<boolean>} A promise which resolves to `true` if the flush completes successfully before the timeout, or `false` if
	* it doesn't.
	*/
	async close(timeout) {
		Object.defineProperty(this, CLOSED_CLIENT_SYMBOL, { value: true });
		const result = await this.flush(timeout);
		this.getOptions().enabled = false;
		this.emit("close");
		return result;
	}
	/**
	* Get all installed event processors.
	*/
	getEventProcessors() {
		return this._eventProcessors;
	}
	/**
	* Adds an event processor that applies to any event processed by this client.
	*/
	addEventProcessor(eventProcessor) {
		this._eventProcessors.push(eventProcessor);
	}
	/**
	* Initialize this client.
	* Call this after the client was set on a scope.
	*/
	init() {
		if (this._isEnabled() || this._options.integrations.some(({ name }) => name.startsWith("Spotlight"))) {
			this._setupIntegrations();
			maybeWarnAboutIgnoredTransactionOptions(this._options);
		}
	}
	/**
	* Gets an installed integration by its name.
	*
	* @returns {Integration|undefined} The installed integration or `undefined` if no integration with that `name` was installed.
	*/
	getIntegrationByName(integrationName) {
		return this._integrations[integrationName];
	}
	/**
	* Returns the names of all installed integrations.
	*/
	getIntegrationNames() {
		return Object.keys(this._integrations);
	}
	/**
	* Add an integration to the client.
	* This can be used to e.g. lazy load integrations.
	* In most cases, this should not be necessary,
	* and you're better off just passing the integrations via `integrations: []` at initialization time.
	* However, if you find the need to conditionally load & add an integration, you can use `addIntegration` to do so.
	*/
	addIntegration(integration) {
		const isAlreadyInstalled = this._integrations[integration.name];
		if (!isAlreadyInstalled && integration.beforeSetup) integration.beforeSetup(this);
		setupIntegration(this, integration, this._integrations);
		if (!isAlreadyInstalled) afterSetupIntegrations(this, [integration]);
	}
	/**
	* Send a fully prepared event to Sentry.
	*/
	sendEvent(event, hint = {}) {
		this.emit("beforeSendEvent", event, hint);
		const genAiSpanItem = extractGenAiSpansFromEvent(event, this);
		let env = createEventEnvelope(event, this._dsn, this._options._metadata, this._options.tunnel);
		if (!isInternalException(hint)) for (const attachment of hint.attachments || []) env = addItemToEnvelope(env, createAttachmentEnvelopeItem(attachment));
		if (genAiSpanItem) env = addItemToEnvelope(env, genAiSpanItem);
		this.sendEnvelope(env).then((sendResponse) => this.emit("afterSendEvent", event, sendResponse));
	}
	/**
	* Send a session or session aggregrates to Sentry.
	*/
	sendSession(session) {
		const { release: clientReleaseOption, environment: clientEnvironmentOption = DEFAULT_ENVIRONMENT } = this._options;
		if ("aggregates" in session) {
			const sessionAttrs = session.attrs || {};
			if (!sessionAttrs.release && !clientReleaseOption) {
				DEBUG_BUILD$2 && debug.warn(MISSING_RELEASE_FOR_SESSION_ERROR);
				return;
			}
			sessionAttrs.release = sessionAttrs.release || clientReleaseOption;
			sessionAttrs.environment = sessionAttrs.environment || clientEnvironmentOption;
			session.attrs = sessionAttrs;
		} else {
			if (!session.release && !clientReleaseOption) {
				DEBUG_BUILD$2 && debug.warn(MISSING_RELEASE_FOR_SESSION_ERROR);
				return;
			}
			session.release = session.release || clientReleaseOption;
			session.environment = session.environment || clientEnvironmentOption;
		}
		this.emit("beforeSendSession", session);
		const env = createSessionEnvelope(session, this._dsn, this._options._metadata, this._options.tunnel);
		this.sendEnvelope(env);
	}
	/**
	* Record on the client that an event got dropped (ie, an event that will not be sent to Sentry).
	*/
	recordDroppedEvent(reason, category, count = 1) {
		if (this._options.sendClientReports) {
			const key = `${reason}:${category}`;
			DEBUG_BUILD$2 && debug.log(`Recording outcome: "${key}"${count > 1 ? ` (${count} times)` : ""}`);
			this._outcomes[key] = (this._outcomes[key] || 0) + count;
		}
	}
	/**
	* Register a hook on this client.
	*/
	on(hook, callback) {
		const hookCallbacks = this._hooks[hook] = this._hooks[hook] || /* @__PURE__ */ new Set();
		const uniqueCallback = (...args) => callback(...args);
		hookCallbacks.add(uniqueCallback);
		return () => {
			hookCallbacks.delete(uniqueCallback);
		};
	}
	/**
	* Emit a hook that was previously registered via `on()`.
	*/
	emit(hook, ...rest) {
		const callbacks = this._hooks[hook];
		if (callbacks) callbacks.forEach((callback) => callback(...rest));
	}
	/**
	* Send an envelope to Sentry.
	*/
	async sendEnvelope(envelope) {
		this.emit("beforeEnvelope", envelope);
		if (this._isEnabled() && this._transport) try {
			const result = await this._transport.send(envelope);
			this.emit("afterEnvelope", envelope);
			return result;
		} catch (reason) {
			DEBUG_BUILD$2 && debug.error("Error while sending envelope:", reason);
			return {};
		}
		DEBUG_BUILD$2 && debug.error("Transport disabled");
		return {};
	}
	/**
	* Register a cleanup function to be called when the client is disposed.
	* This is useful for integrations that need to clean up global state.
	*
	* NOTE: This is a no-op in the base `Client` class. Subclasses like `ServerRuntimeClient`
	* override this method to actually register and execute cleanup callbacks.
	*/
	registerCleanup(callback) {}
	/**
	* Disposes of the client and releases all resources.
	*
	* Subclasses should override this method to clean up their own resources, including invoking
	* any callbacks registered via {@link Client.registerCleanup}. The base implementation is a
	* no-op and does NOT execute registered cleanup callbacks.
	*
	* After calling dispose(), the client should not be used anymore.
	*/
	dispose() {}
	/** Setup integrations for this client. */
	_setupIntegrations() {
		const { integrations } = this._options;
		this._integrations = setupIntegrations(this, integrations);
		afterSetupIntegrations(this, integrations);
	}
	/** Updates existing session based on the provided event */
	_updateSessionFromEvent(session, event) {
		let unhandled = event.level === "fatal";
		let errored = false;
		const exceptions = event.exception?.values;
		if (exceptions) {
			errored = true;
			unhandled = false;
			for (const ex of exceptions) if (ex.mechanism?.handled === false) {
				unhandled = true;
				break;
			}
		}
		const sessionNonTerminal = session.status === "ok";
		if (sessionNonTerminal && session.errors === 0 || sessionNonTerminal && unhandled) {
			updateSession(session, {
				...unhandled && { status: this._unhandledSessionStatus },
				errors: session.errors || Number(errored || unhandled)
			});
			this.captureSession(session);
		}
	}
	/**
	* Determine if the client is finished processing. Returns a promise because it will wait `timeout` ms before saying
	* "no" (resolving to `false`) in order to give the client a chance to potentially finish first.
	*
	* @param timeout The time, in ms, after which to resolve to `false` if the client is still busy. Passing `0` (or not
	* passing anything) will make the promise wait as long as it takes for processing to finish before resolving to
	* `true`.
	* @returns A promise which will resolve to `true` if processing is already done or finishes before the timeout, and
	* `false` otherwise
	*/
	async _isClientDoneProcessing(timeout) {
		let ticked = 0;
		while (!timeout || ticked < timeout) {
			await new Promise((resolve) => setTimeout(resolve, 1));
			if (!this._numProcessing) return true;
			ticked++;
		}
		return false;
	}
	/** Determines whether this SDK is enabled and a transport is present. */
	_isEnabled() {
		return this.getOptions().enabled !== false && this._transport !== void 0;
	}
	/**
	* Adds common information to events.
	*
	* The information includes release and environment from `options`,
	* breadcrumbs and context (extra, tags and user) from the scope.
	*
	* Information that is already present in the event is never overwritten. For
	* nested objects, such as the context, keys are merged.
	*
	* @param event The original event.
	* @param hint May contain additional information about the original exception.
	* @param currentScope A scope containing event metadata.
	* @returns A new event with more information.
	*/
	_prepareEvent(event, hint, currentScope, isolationScope) {
		const options = this.getOptions();
		const integrations = this.getIntegrationNames();
		if (!hint.integrations && integrations.length) hint.integrations = integrations;
		this.emit("preprocessEvent", event, hint);
		if (!event.type) isolationScope.setLastEventId(event.event_id || hint.event_id);
		return prepareEvent(options, event, hint, currentScope, this, isolationScope).then((evt) => {
			if (evt === null) return evt;
			this.emit("postprocessEvent", evt, hint);
			evt.contexts = {
				trace: {
					...evt.contexts?.trace,
					...getTraceContextFromScope(currentScope)
				},
				...evt.contexts
			};
			evt.sdkProcessingMetadata = {
				dynamicSamplingContext: getDynamicSamplingContextFromScope(this, currentScope),
				...evt.sdkProcessingMetadata
			};
			return evt;
		});
	}
	/**
	* Processes the event and logs an error in case of rejection
	* @param event
	* @param hint
	* @param scope
	*/
	_captureEvent(event, hint = {}, currentScope = getCurrentScope(), isolationScope = getIsolationScope()) {
		if (DEBUG_BUILD$2 && isErrorEvent(event)) debug.log(`Captured error event \`${getPossibleEventMessages(event)[0] || "<unknown>"}\``);
		return this._processEvent(event, hint, currentScope, isolationScope).then((finalEvent) => {
			return finalEvent.event_id;
		}, (reason) => {
			if (DEBUG_BUILD$2) {
				if (_isDoNotSendEventError(reason)) debug.log(reason.message);
				else if (_isInternalError(reason)) debug.warn(reason.message);
				else debug.warn(reason);
			}
		});
	}
	/**
	* Processes an event (either error or message) and sends it to Sentry.
	*
	* This also adds breadcrumbs and context information to the event. However,
	* platform specific meta data (such as the User's IP address) must be added
	* by the SDK implementor.
	*
	*
	* @param event The event to send to Sentry.
	* @param hint May contain additional information about the original exception.
	* @param currentScope A scope containing event metadata.
	* @returns A SyncPromise that resolves with the event or rejects in case event was/will not be send.
	*/
	_processEvent(event, hint, currentScope, isolationScope) {
		const options = this.getOptions();
		const { sampleRate } = options;
		const isTransaction = isTransactionEvent(event);
		const isError = isErrorEvent(event);
		const beforeSendLabel = `before send for type \`${event.type || "error"}\``;
		let beforeSendDropReason = "before_send";
		let ignoredSpanCount = 0;
		const parsedSampleRate = typeof sampleRate === "undefined" ? void 0 : parseSampleRate(sampleRate);
		const isSampledOut = isError && typeof parsedSampleRate === "number" && safeMathRandom() > parsedSampleRate;
		const dataCategory = getDataCategoryByType(event.type);
		let preparedSpanCount = 0;
		const session = currentScope.getSession() || isolationScope.getSession();
		if (isSampledOut && session?.status !== "ok") {
			this.recordDroppedEvent("sample_rate", "error");
			return rejectedSyncPromise(_makeSampledOutError(sampleRate));
		}
		return this._prepareEvent(event, hint, currentScope, isolationScope).then((prepared) => {
			if (prepared === null) throw _makeDoNotSendEventError("An event processor returned `null`, will not send event.");
			preparedSpanCount = prepared.spans?.length || 0;
			if (isInternalException(hint)) return prepared;
			return processBeforeSend(options, prepared, hint, (reason) => {
				beforeSendDropReason = reason;
			}, (count) => {
				ignoredSpanCount = count;
			});
		}).then((processedEvent) => {
			if (ignoredSpanCount) this.recordDroppedEvent("ignored", "span", ignoredSpanCount);
			if (!isPlainObject(processedEvent) || processedEvent === null) {
				this.recordDroppedEvent(beforeSendDropReason, dataCategory);
				if (isTransaction) this.recordDroppedEvent(beforeSendDropReason, "span", 1 + preparedSpanCount - ignoredSpanCount);
				if (processedEvent !== null) throw _makeInternalError(`${beforeSendLabel} must return \`null\` or a valid event.`);
				throw _makeDoNotSendEventError(`${beforeSendDropReason === "ignored" ? "Transaction matched `ignoreSpans`" : `${beforeSendLabel} ${beforeSendDropReason === "callback_error" ? "threw an error" : "returned `null`"}`}, will not send event.`);
			}
			if (isError && session) this._updateSessionFromEvent(session, processedEvent);
			if (isSampledOut) {
				this.recordDroppedEvent("sample_rate", "error");
				throw _makeSampledOutError(sampleRate);
			}
			if (isTransaction) {
				const droppedSpanCount = preparedSpanCount - ignoredSpanCount - (processedEvent.spans?.length || 0);
				if (droppedSpanCount > 0) this.recordDroppedEvent("before_send", "span", droppedSpanCount);
			}
			const transactionInfo = processedEvent.transaction_info;
			if (isTransaction && transactionInfo && processedEvent.transaction !== event.transaction) {
				const source = "custom";
				processedEvent.transaction_info = {
					...transactionInfo,
					source
				};
			}
			this.sendEvent(processedEvent, hint);
			return processedEvent;
		}).then(null, (reason) => {
			if (_isDoNotSendEventError(reason) || _isInternalError(reason)) throw reason;
			this.captureException(reason, {
				mechanism: {
					handled: false,
					type: "internal"
				},
				data: { __sentry__: true },
				originalException: reason
			});
			throw _makeInternalError(`Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.\nReason: ${reason}`);
		});
	}
	/**
	* Occupies the client with processing and event
	*/
	_process(taskProducer, dataCategory) {
		this._numProcessing++;
		this._promiseBuffer.add(taskProducer).then((value) => {
			this._numProcessing--;
			return value;
		}, (reason) => {
			this._numProcessing--;
			if (reason === SENTRY_BUFFER_FULL_ERROR) this.recordDroppedEvent("queue_overflow", dataCategory);
			return reason;
		});
	}
	/**
	* Clears outcomes on this client and returns them.
	*/
	_clearOutcomes() {
		const outcomes = this._outcomes;
		this._outcomes = {};
		return Object.entries(outcomes).map(([key, quantity]) => {
			const [reason, category] = key.split(":");
			return {
				reason,
				category,
				quantity
			};
		});
	}
	/**
	* Sends client reports as an envelope.
	*/
	_flushOutcomes() {
		DEBUG_BUILD$2 && debug.log("Flushing outcomes...");
		const outcomes = this._clearOutcomes();
		if (outcomes.length === 0) {
			DEBUG_BUILD$2 && debug.log("No outcomes to send");
			return;
		}
		if (!this._dsn) {
			DEBUG_BUILD$2 && debug.log("No dsn provided, will not send outcomes");
			return;
		}
		DEBUG_BUILD$2 && debug.log("Sending outcomes:", outcomes);
		const envelope = createClientReportEnvelope(outcomes, this._options.tunnel && dsnToString(this._dsn));
		this.sendEnvelope(envelope);
	}
};
/**
* Process the matching `beforeSendXXX` callback.
*/
function processBeforeSend(options, event, hint, onDrop, onIgnoredSpans) {
	const { beforeSend, ignoreSpans, beforeSendTransaction } = options;
	const beforeSendSpan = isStaticBeforeSendSpanCallback(options.beforeSendSpan) && options.beforeSendSpan;
	let processedEvent = event;
	if (isErrorEvent(processedEvent) && beforeSend) {
		const errorEvent = processedEvent;
		return safeCallback(DEBUG_BUILD$2 ? "The `beforeSend` callback threw an error, dropping the event:" : "", () => beforeSend(errorEvent, hint), () => {
			onDrop("callback_error");
			return null;
		});
	}
	if (isTransactionEvent(processedEvent)) {
		if (beforeSendSpan || ignoreSpans) {
			const rootSpanJson = convertTransactionEventToSpanJson(processedEvent);
			if (ignoreSpans?.length && shouldIgnoreSpan({
				description: rootSpanJson.description,
				op: rootSpanJson.op,
				attributes: rootSpanJson.data
			}, ignoreSpans)) {
				onDrop("ignored");
				return null;
			}
			if (beforeSendSpan) {
				const processedRootSpanJson = applyBeforeSendSpanCallback(rootSpanJson, beforeSendSpan);
				processedEvent = merge(event, convertSpanJsonToTransactionEvent(processedRootSpanJson));
			}
			if (processedEvent.spans) {
				const processedSpans = [];
				const initialSpans = processedEvent.spans;
				for (const span of initialSpans) {
					if (ignoreSpans?.length && shouldIgnoreSpan({
						description: span.description,
						op: span.op,
						attributes: span.data
					}, ignoreSpans)) {
						reparentChildSpans(initialSpans, span);
						continue;
					}
					if (beforeSendSpan) processedSpans.push(applyBeforeSendSpanCallback(span, beforeSendSpan));
					else processedSpans.push(span);
				}
				onIgnoredSpans(initialSpans.length - processedSpans.length);
				processedEvent.spans = processedSpans;
			}
		}
		if (beforeSendTransaction) return safeCallback(DEBUG_BUILD$2 ? "The `beforeSendTransaction` callback threw an error, dropping the event:" : "", () => beforeSendTransaction(processedEvent, hint), () => {
			onDrop("callback_error");
			return null;
		});
	}
	return processedEvent;
}
function isErrorEvent(event) {
	return event.type === void 0;
}
function isTransactionEvent(event) {
	return event.type === "transaction";
}

// src/sdk.ts
/**
* Internal function to create a new SDK client instance. The client is
* installed and then bound to the current scope.
*
* @param clientClass The client class to instantiate.
* @param options Options to pass to the client.
*/
function initAndBind(clientClass, options) {
	if (options.debug === true) {
		if (DEBUG_BUILD$2) debug.enable();
		else consoleSandbox(() => {
			console.warn("[Sentry] Cannot initialize SDK with `debug` option using a non-debug bundle.");
		});
	}
	warnIfClientIsActive();
	getCurrentScope().update(options.initialScope);
	const client = new clientClass(options);
	setCurrentClient(client);
	client.init();
	return client;
}
/**
* Returns the client bound to the current scope, unless it is closed.
*
* @hidden
*/
function getActiveClient() {
	const client = getClient();
	return client && !isClientClosed(client) ? client : void 0;
}
/**
* Warns when `init()` runs while a client is still bound. The new client
* replaces it, but the old client stays alive, so the two can mix state.
*
* @hidden
*/
function warnIfClientIsActive() {
	if (getActiveClient()) consoleSandbox(() => {
		console.warn("[Sentry] `Sentry.init()` was called more than once. The new client replaces the active client, but the active client is not closed, so state from both can mix. Call `Sentry.init()` only once, or call `await Sentry.close()` before you call it again.");
	});
}
/**
* Make the given client the current client.
*/
function setCurrentClient(client) {
	getCurrentScope().setClient(client);
}

// src/utils/data-collection/filterQueryParams.ts
/**
* Filters a query parameter string according to a `CollectBehavior`.
*
* Parameter names are decoded for filtering, while the original encoding, order, and duplicate keys are preserved.
*/
function filterQueryParams(queryString, behavior) {
	if (!queryString || behavior === false) return;
	return queryString.split("&").map((pair) => {
		const separatorIndex = pair.indexOf("=");
		const encodedKey = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);
		const key = new URLSearchParams(`${encodedKey}=`).keys().next().value;
		return key !== void 0 && shouldFilterDataKey(key, behavior) ? `${encodedKey}=${FILTERED_VALUE}` : pair;
	}).join("&");
}

// src/utils/data-collection/filterUrlQuery.ts
/**
* Applies a `CollectBehavior` to the query string of a full URL, leaving every other URL component
* (scheme, host, path, fragment) untouched.
*
* The query is located by string offsets rather than by parsing, so the URL is returned byte-for-byte
* apart from the query itself. This keeps relative URLs, non-HTTP schemes and unusual encodings intact,
* none of which survive a `URL` round-trip.
*
* Returns the URL with its query filtered, or with the query removed entirely when collection is off.
*/
function filterUrlQuery(url, behavior) {
	const fragmentStart = url.indexOf("#");
	const queryEnd = fragmentStart === -1 ? url.length : fragmentStart;
	const queryStart = url.indexOf("?");
	if (queryStart === -1 || queryStart > queryEnd) return url;
	const prefix = url.slice(0, queryStart);
	const query = url.slice(queryStart + 1, queryEnd);
	const suffix = url.slice(queryEnd);
	const filtered = filterQueryParams(query, behavior);
	return filtered ? `${prefix}?${filtered}${suffix}` : `${prefix}${suffix}`;
}

// src/utils/data-collection/filterCollectedUrl.ts
function urlQueryParamsBehavior(client) {
	return (client ?? getClient())?.getDataCollectionOptions().urlQueryParams ?? true;
}
function filterCollectedUrl(url, client) {
	return url === void 0 ? void 0 : filterUrlQuery(url, urlQueryParamsBehavior(client));
}

// src/utils/url.ts
const DEFAULT_BASE_URL = "thismessage:/";
/**
* Checks if the URL object is relative
*
* @param url - The URL object to check
* @returns True if the URL object is relative, false otherwise
*/
function isURLObjectRelative(url) {
	return "isRelative" in url;
}
/**
* Parses string to a URL object
*
* @param url - The URL to parse
* @returns The parsed URL object or undefined if the URL is invalid
*/
function parseStringToURLObject(url, urlBase) {
	const isRelative = url.indexOf("://") <= 0 && url.indexOf("//") !== 0;
	const base = urlBase ?? (isRelative ? DEFAULT_BASE_URL : void 0);
	try {
		if ("canParse" in URL && !URL.canParse(url, base)) return;
		const fullUrlObject = new URL(url, base);
		if (isRelative) return {
			isRelative,
			pathname: fullUrlObject.pathname,
			search: fullUrlObject.search,
			hash: fullUrlObject.hash
		};
		return fullUrlObject;
	} catch {}
}
/**
* Parses string form of URL into an object
* // borrowed from https://tools.ietf.org/html/rfc3986#appendix-B
* // intentionally using regex and not <a/> href parsing trick because React Native and other
* // environments where DOM might not be available
* @returns parsed URL object
*/
function parseUrl(url) {
	if (!url) return {};
	const match = url.match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);
	if (!match) return {};
	const query = match[6] || "";
	const fragment = match[8] || "";
	return {
		host: match[4],
		path: match[5],
		protocol: match[2],
		search: query,
		hash: fragment,
		relative: match[5] + query + fragment
	};
}
/**
* Strips the content from a data URL, returning a placeholder with the MIME type.
*
* Data URLs can be very long (e.g. base64 encoded scripts for Web Workers),
* with little valuable information, often leading to envelopes getting dropped due
* to size limit violations. Therefore, we strip data URLs and replace them with a
* placeholder.
*
* @param url - The URL to process
* @param includeDataPrefix - If true, includes the first 10 characters of the data stream
*                            for debugging (e.g., to identify magic bytes like WASM's AGFzbQ).
*                            Defaults to true.
* @returns For data URLs, returns a short format like `data:text/javascript;base64,SGVsbG8gV2... [truncated]`.
*          For non-data URLs, returns the original URL unchanged.
*/
function stripDataUrlContent(url, includeDataPrefix = true) {
	if (url.startsWith("data:")) {
		const match = url.match(/^data:([^;,]+)/);
		const mimeType = match ? match[1] : "text/plain";
		const isBase64 = url.includes(";base64,");
		const dataStart = url.indexOf(",");
		let dataPrefix = "";
		if (includeDataPrefix && dataStart !== -1) {
			const data = url.slice(dataStart + 1);
			dataPrefix = data.length > 10 ? `${data.slice(0, 10)}... [truncated]` : data;
		}
		return `data:${mimeType}${isBase64 ? ",base64" : ""}${dataPrefix ? `,${dataPrefix}` : ""}`;
	}
	return url;
}

// src/utils/hash.ts
/**
* 32-bit FNV-1a. Keep this algorithm stable: tunnel paths must match across SDK versions.
*/
function fnv1a32(input) {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

/**
* Returns the same-origin tunnel path for a DSN, e.g. `/k3x9q2a`, by default the active client's. Browser and server
* derive it independently, and as a hash it gives ad-blocker filter lists nothing to match.
*/
function getTunnelPath(dsn) {
	const components = dsn ? makeDsn(dsn) : getClient()?.getDsn();
	return components ? `/${fnv1a32(dsnToString(components))}` : void 0;
}
/**
* Normalizes a base path to `/app`, or `''` for the root.
*/
function normalizeTunnelBasePath(basePath) {
	const path = (basePath?.startsWith("./") ? basePath.slice(1) : basePath ?? "").replace(/\/$/, "");
	return !path || path.startsWith("/") ? path : `/${path}`;
}

// src/utils/ipAddress.ts
/**
* @internal
*/
function addAutoIpAddressToSession(session) {
	if ("aggregates" in session) {
		if (session.attrs?.["ip_address"] === void 0) session.attrs = {
			...session.attrs,
			ip_address: "{{auto}}"
		};
	} else if (session.ipAddress === void 0) session.ipAddress = "{{auto}}";
}

// src/utils/sdkMetadata.ts
/**
* Preserve user-provided option keys before SDK wrappers add defaults.
* @internal
*/
function captureOptionsSetByUser(options) {
	if (options._metadata?.optionsSetByUser) return options;
	return {
		...options,
		_metadata: {
			...options._metadata,
			optionsSetByUser: Object.keys(options).filter((key) => key !== "_metadata").sort()
		}
	};
}
/**
* A builder for the SDK metadata in the options for the SDK initialization.
*
* Note: This function is identical to `buildMetadata` in Remix and NextJS and SvelteKit.
* We don't extract it for bundle size reasons.
* @see https://github.com/getsentry/sentry-javascript/pull/7404
* @see https://github.com/getsentry/sentry-javascript/pull/4196
*
* If you make changes to this function consider updating the others as well.
*
* @param options SDK options object that gets mutated
* @param names list of package names
*/
function applySdkMetadata(options, name, names = [name], source = "npm") {
	const sdk = (options._metadata = options._metadata || {}).sdk = options._metadata.sdk || {};
	if (!sdk.name) {
		sdk.name = `sentry.javascript.${name}`;
		sdk.packages = names.map((name) => ({
			name: `${source}:@sentry/${name}`,
			version: SDK_VERSION
		}));
		sdk.version = SDK_VERSION;
	}
}

// src/breadcrumbs.ts
/**
* Default maximum number of breadcrumbs added to an event. Can be overwritten
* with {@link Options.maxBreadcrumbs}.
*/
const DEFAULT_BREADCRUMBS = 100;
/**
* Records a new breadcrumb which will be attached to future events.
*
* Breadcrumbs will be added to subsequent events to provide more context on
* user's actions prior to an error or crash.
*/
function addBreadcrumb(breadcrumb, hint) {
	const client = getClient();
	const isolationScope = getIsolationScope();
	if (!client) return;
	const { beforeBreadcrumb = null, maxBreadcrumbs = DEFAULT_BREADCRUMBS } = client.getOptions();
	if (maxBreadcrumbs <= 0) return;
	const mergedBreadcrumb = {
		timestamp: dateTimestampInSeconds(),
		...breadcrumb
	};
	const finalBreadcrumb = beforeBreadcrumb ? safeCallback(DEBUG_BUILD$2 ? "The `beforeBreadcrumb` callback threw an error, dropping the breadcrumb:" : "", () => consoleSandbox(() => beforeBreadcrumb(mergedBreadcrumb, hint)), () => null) : mergedBreadcrumb;
	if (finalBreadcrumb === null) return;
	if (client.emit) client.emit("beforeAddBreadcrumb", finalBreadcrumb, hint);
	isolationScope.addBreadcrumb(finalBreadcrumb, maxBreadcrumbs);
}

// src/integrations/functiontostring.ts
const INTEGRATION_NAME$9 = "FunctionToString";
const SETUP_CLIENTS = /* @__PURE__ */ new WeakMap();
const _functionToStringIntegration = (() => {
	return {
		name: INTEGRATION_NAME$9,
		setupOnce() {
			const originalFunctionToString = Function.prototype.toString;
			const callOriginalFunctionToString = Function.prototype.call.bind(originalFunctionToString);
			const hasOwnProperty = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
			try {
				Function.prototype.toString = function() {
					let unwrappedFunction;
					try {
						if (SETUP_CLIENTS.has(getClient()) && hasOwnProperty(this, "__sentry_original__")) unwrappedFunction = getOriginalFunction(this);
					} catch {}
					return callOriginalFunctionToString(unwrappedFunction ?? this);
				};
			} catch {}
		},
		setup(client) {
			SETUP_CLIENTS.set(client, true);
		}
	};
});
/**
* Patch toString calls to return proper name for wrapped functions.
*
* ```js
* Sentry.init({
*   integrations: [
*     functionToStringIntegration(),
*   ],
* });
* ```
*/
const functionToStringIntegration = defineIntegration(_functionToStringIntegration);

// src/integrations/eventFilters.ts
const DEFAULT_IGNORE_ERRORS = [
	/^Script error\.?$/,
	/^Javascript error: Script error\.? on line 0$/,
	/^ResizeObserver loop completed with undelivered notifications.$/,
	/^Cannot redefine property: googletag$/,
	/^Can't find variable: gmo$/,
	/^undefined is not an object \(evaluating 'a\.[A-Z]'\)$/,
	/can't redefine non-configurable property "solana"/,
	/vv\(\)\.getRestrictions is not a function/,
	/Can't find variable: _AutofillCallbackHandler/,
	/Object Not Found Matching Id:\d+, MethodName:simulateEvent/,
	/Java exception was raised during method invocation$/,
	/Java object is gone$/
];
const INTEGRATION_NAME$8 = "EventFilters";
/**
* An integration that filters out events (errors and transactions) based on:
*
* - (Errors) A curated list of known low-value or irrelevant errors (see {@link DEFAULT_IGNORE_ERRORS})
* - (Errors) A list of error messages or urls/filenames passed in via
*   - Top level Sentry.init options (`ignoreErrors`, `denyUrls`, `allowUrls`)
*   - The same options passed to the integration directly via @param options
* - (Transactions/Spans) A list of root span (transaction) names passed in via
*   - Top level Sentry.init option (`ignoreTransactions`)
*   - The same option passed to the integration directly via @param options
*
* Events filtered by this integration will not be sent to Sentry.
*/
const eventFiltersIntegration = defineIntegration((options = {}) => {
	let mergedOptions;
	return {
		name: INTEGRATION_NAME$8,
		setup(client) {
			mergedOptions = _mergeOptions(options, client.getOptions());
		},
		processEvent(event, _hint, client) {
			if (!mergedOptions) mergedOptions = _mergeOptions(options, client.getOptions());
			return _shouldDropEvent$1(event, mergedOptions) ? null : event;
		}
	};
});
function _mergeOptions(internalOptions = {}, clientOptions = {}) {
	return {
		allowUrls: [...internalOptions.allowUrls || [], ...clientOptions.allowUrls || []],
		denyUrls: [...internalOptions.denyUrls || [], ...clientOptions.denyUrls || []],
		ignoreErrors: [
			...internalOptions.ignoreErrors || [],
			...clientOptions.ignoreErrors || [],
			...internalOptions.disableErrorDefaults ? [] : DEFAULT_IGNORE_ERRORS
		],
		ignoreTransactions: [...internalOptions.ignoreTransactions || [], ...clientOptions.ignoreTransactions || []]
	};
}
function _shouldDropEvent$1(event, options) {
	if (!event.type) {
		if (_isIgnoredError(event, options.ignoreErrors)) {
			DEBUG_BUILD$2 && debug.warn(`Event dropped due to being matched by \`ignoreErrors\` option.\nEvent: ${getEventDescription(event)}`);
			return true;
		}
		if (_isUselessError(event)) {
			DEBUG_BUILD$2 && debug.warn(`Event dropped due to not having an error message, error type or stacktrace.\nEvent: ${getEventDescription(event)}`);
			return true;
		}
		if (_isDeniedUrl(event, options.denyUrls)) {
			DEBUG_BUILD$2 && debug.warn(`Event dropped due to being matched by \`denyUrls\` option.\nEvent: ${getEventDescription(event)}.\nUrl: ${_getEventFilterUrl(event)}`);
			return true;
		}
		if (!_isAllowedUrl(event, options.allowUrls)) {
			DEBUG_BUILD$2 && debug.warn(`Event dropped due to not being matched by \`allowUrls\` option.\nEvent: ${getEventDescription(event)}.\nUrl: ${_getEventFilterUrl(event)}`);
			return true;
		}
	} else if (event.type === "transaction") {
		if (_isIgnoredTransaction(event, options.ignoreTransactions)) {
			DEBUG_BUILD$2 && debug.warn(`Event dropped due to being matched by \`ignoreTransactions\` option.\nEvent: ${getEventDescription(event)}`);
			return true;
		}
	}
	return false;
}
function _isIgnoredError(event, ignoreErrors) {
	if (!ignoreErrors?.length) return false;
	return getPossibleEventMessages(event).some((message) => stringMatchesSomePattern(message, ignoreErrors));
}
function _isIgnoredTransaction(event, ignoreTransactions) {
	if (!ignoreTransactions?.length) return false;
	const name = event.transaction;
	return name ? stringMatchesSomePattern(name, ignoreTransactions) : false;
}
function _isDeniedUrl(event, denyUrls) {
	if (!denyUrls?.length) return false;
	const url = _getEventFilterUrl(event);
	return !url ? false : stringMatchesSomePattern(url, denyUrls);
}
function _isAllowedUrl(event, allowUrls) {
	if (!allowUrls?.length) return true;
	const url = _getEventFilterUrl(event);
	return !url ? true : stringMatchesSomePattern(url, allowUrls);
}
function _getLastValidUrl(frames = []) {
	for (let i = frames.length - 1; i >= 0; i--) {
		const frame = frames[i];
		if (frame && frame.filename !== "<anonymous>" && frame.filename !== "[native code]") return frame.filename || null;
	}
	return null;
}
function _getEventFilterUrl(event) {
	try {
		const frames = [...event.exception?.values ?? []].reverse().find((value) => value.mechanism?.parent_id === void 0 && value.stacktrace?.frames?.length)?.stacktrace?.frames;
		return frames ? _getLastValidUrl(frames) : null;
	} catch {
		DEBUG_BUILD$2 && debug.error(`Cannot extract url for event ${getEventDescription(event)}`);
		return null;
	}
}
function _isUselessError(event) {
	if (!event.exception?.values?.length) return false;
	return !event.message && !event.exception.values.some((value) => value.stacktrace || value.type && value.type !== "Error" || value.value);
}

// src/utils/aggregate-errors.ts
/**
* Creates exceptions inside `event.exception.values` for errors that are nested on properties based on the `key` parameter.
*/
function applyAggregateErrorsToEvent(exceptionFromErrorImplementation, parser, key, limit, event, hint) {
	if (!event.exception?.values || !hint || !isError(hint.originalException)) return;
	const originalException = event.exception.values.length > 0 ? event.exception.values[event.exception.values.length - 1] : void 0;
	if (originalException) event.exception.values = aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, hint.originalException, key, event.exception.values, originalException, 0);
}
function aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, error, key, prevExceptions, exception, exceptionId) {
	if (prevExceptions.length >= limit + 1) return prevExceptions;
	let newExceptions = [...prevExceptions];
	if (isError(error[key])) {
		applyExceptionGroupFieldsForParentException(exception, exceptionId, error);
		const newException = exceptionFromErrorImplementation(parser, error[key]);
		const newExceptionId = newExceptions.length;
		applyExceptionGroupFieldsForChildException(newException, key, newExceptionId, exceptionId);
		newExceptions = aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, error[key], key, [newException, ...newExceptions], newException, newExceptionId);
	}
	if (isExceptionGroup(error)) error.errors.forEach((childError, i) => {
		if (newExceptions.length < limit + 1 && isError(childError)) {
			applyExceptionGroupFieldsForParentException(exception, exceptionId, error);
			const newException = exceptionFromErrorImplementation(parser, childError);
			const newExceptionId = newExceptions.length;
			applyExceptionGroupFieldsForChildException(newException, `errors[${i}]`, newExceptionId, exceptionId);
			newExceptions = aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, childError, key, [newException, ...newExceptions], newException, newExceptionId);
		}
	});
	if (isSuppressedError(error)) ["error", "suppressed"].forEach((property) => {
		const childError = error[property];
		if (newExceptions.length < limit + 1 && isError(childError)) {
			applyExceptionGroupFieldsForParentException(exception, exceptionId, error);
			const newException = exceptionFromErrorImplementation(parser, childError);
			const newExceptionId = newExceptions.length;
			applyExceptionGroupFieldsForChildException(newException, property, newExceptionId, exceptionId);
			newExceptions = aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, childError, key, [newException, ...newExceptions], newException, newExceptionId);
		}
	});
	return newExceptions;
}
function isExceptionGroup(error) {
	return Array.isArray(error.errors);
}
function isSuppressedError(error) {
	return "error" in error && "suppressed" in error;
}
function applyExceptionGroupFieldsForParentException(exception, exceptionId, error) {
	exception.mechanism = {
		handled: true,
		type: "auto.core.linked_errors",
		...isExceptionGroup(error) && { is_exception_group: true },
		...exception.mechanism,
		exception_id: exceptionId
	};
}
function applyExceptionGroupFieldsForChildException(exception, source, exceptionId, parentId) {
	exception.mechanism = {
		handled: true,
		...exception.mechanism,
		type: "chained",
		source,
		exception_id: exceptionId,
		parent_id: parentId
	};
}

function hasSentryFetchUrlHost(error) {
	return isError(error) && "__sentry_fetch_url_host__" in error && typeof error.__sentry_fetch_url_host__ === "string";
}
/**
* Enhances the error message with the hostname for better Sentry error reporting.
* This allows third-party packages to still match on the original error message,
* while Sentry gets the enhanced version with context.
*
* Only used internally
* @hidden
*/
function _enhanceErrorWithSentryInfo(error) {
	const message = errorMessageToString(error.message);
	if (hasSentryFetchUrlHost(error)) return `${message} (${error.__sentry_fetch_url_host__})`;
	return message;
}
function errorMessageToString(message) {
	if (typeof message === "string") return message;
	if (message == null) return "";
	if (isPrimitive(message)) return String(message);
	if (isPlainObject(message) || Array.isArray(message)) {
		const json = stringify(message, "");
		if (json) return json;
	}
	return stringifyValue(void 0, message);
}

// src/instrument/console.ts
/**
* Filter out console messages that match the given strings or regular expressions.
* These will neither be passed to the handler, and they will also not be logged to the user, unless they have debug enabled.
* This is a set to avoid duplicate integration setups to add the same filter multiple times.
*/
const _filter = /* @__PURE__ */ new Set([]);
/**
* Add an instrumentation handler for when a console.xxx method is called.
* Returns a function to remove the handler.
*
* Use at your own risk, this might break without changelog notice, only used internally.
* @hidden
*/
function addConsoleInstrumentationHandler(handler) {
	const type = "console";
	const removeHandler = addHandler(type, handler);
	maybeInstrument(type, instrumentConsole);
	return removeHandler;
}
/**
* Add a filter to the console instrumentation to filter out console messages that match the given strings or regular expressions.
* Returns a function to remove the filter.
*/
function addConsoleInstrumentationFilter(filter) {
	for (const f of filter) _filter.add(f);
	return () => {
		for (const f of filter) _filter.delete(f);
	};
}
const instrumentedLevels = /* @__PURE__ */ new Set();
/** Only exported for tests. */
function instrumentConsole() {
	if (!("console" in GLOBAL_OBJ)) return;
	CONSOLE_LEVELS.forEach(function(level) {
		if (instrumentedLevels.has(level) || !(level in GLOBAL_OBJ.console)) return;
		instrumentedLevels.add(level);
		fill(GLOBAL_OBJ.console, level, function(originalConsoleMethod) {
			originalConsoleMethods[level] = originalConsoleMethod;
			return function(...args) {
				const firstArg = args[0];
				const log = originalConsoleMethods[level];
				const isFiltered = _filter.size && typeof firstArg === "string" && stringMatchesSomePattern(firstArg, _filter);
				if (!isFiltered) triggerHandlers("console", {
					args,
					level
				});
				if (!isFiltered || DEBUG_BUILD$2 && debug.isEnabled()) log?.apply(GLOBAL_OBJ.console, args);
			};
		});
	});
}

// src/utils/severity.ts
/**
* Converts a string-based level into a `SeverityLevel`, normalizing it along the way.
*
* @param level String representation of desired `SeverityLevel`.
* @returns The `SeverityLevel` corresponding to the given string, or 'log' if the string isn't a valid level.
*/
function severityLevelFromString(level) {
	return level === "warn" ? "warning" : [
		"fatal",
		"error",
		"warning",
		"log",
		"info",
		"debug"
	].includes(level) ? level : "log";
}

// src/integrations/dedupe.ts
const INTEGRATION_NAME$7 = "Dedupe";
const _dedupeIntegration = (() => {
	let previousEvent;
	return {
		name: INTEGRATION_NAME$7,
		processEvent(currentEvent) {
			if (currentEvent.type) return currentEvent;
			try {
				if (_shouldDropEvent(currentEvent, previousEvent)) {
					DEBUG_BUILD$2 && debug.warn("Event dropped due to being a duplicate of previously captured event.");
					return null;
				}
			} catch {}
			return previousEvent = currentEvent;
		}
	};
});
/**
* Drops an error or message event if it is equal to the previous error or message event.
* Two events are equal if they have the same message (or the same exception type and value),
* the same stack trace and the same fingerprint.
*
* A repeated `captureException` of the same error object is dropped by the client, also without
* this integration (see `checkOrSetAlreadyCaught`).
*/
const dedupeIntegration = defineIntegration(_dedupeIntegration);
/** only exported for tests. */
function _shouldDropEvent(currentEvent, previousEvent) {
	if (!previousEvent) return false;
	if (_isSameMessageEvent(currentEvent, previousEvent)) return true;
	if (_isSameExceptionEvent(currentEvent, previousEvent)) return true;
	return false;
}
function _isSameMessageEvent(currentEvent, previousEvent) {
	const currentMessage = currentEvent.message;
	const previousMessage = previousEvent.message;
	if (!currentMessage && !previousMessage) return false;
	if (currentMessage && !previousMessage || !currentMessage && previousMessage) return false;
	if (currentMessage !== previousMessage) return false;
	if (!_isSameFingerprint(currentEvent, previousEvent)) return false;
	if (!_isSameStacktrace(currentEvent, previousEvent)) return false;
	return true;
}
function _isSameExceptionEvent(currentEvent, previousEvent) {
	const previousException = _getExceptionFromEvent(previousEvent);
	const currentException = _getExceptionFromEvent(currentEvent);
	if (!previousException || !currentException) return false;
	if (previousException.type !== currentException.type || previousException.value !== currentException.value) return false;
	if (!_isSameFingerprint(currentEvent, previousEvent)) return false;
	if (!_isSameStacktrace(currentEvent, previousEvent)) return false;
	return true;
}
function _isSameStacktrace(currentEvent, previousEvent) {
	const currentFrames = getFramesFromEvent(currentEvent);
	const previousFrames = getFramesFromEvent(previousEvent);
	if (!currentFrames || !previousFrames) return !currentFrames && !previousFrames;
	if (previousFrames.length !== currentFrames.length) return false;
	for (let i = 0; i < previousFrames.length; i++) {
		const frameA = previousFrames[i];
		const frameB = currentFrames[i];
		if (frameA.filename !== frameB.filename || frameA.lineno !== frameB.lineno || frameA.colno !== frameB.colno || frameA.function !== frameB.function) return false;
	}
	return true;
}
function _isSameFingerprint(currentEvent, previousEvent) {
	const currentFingerprint = currentEvent.fingerprint;
	const previousFingerprint = previousEvent.fingerprint;
	if (!currentFingerprint || !previousFingerprint) return !currentFingerprint && !previousFingerprint;
	try {
		return !!(currentFingerprint.join("") === previousFingerprint.join(""));
	} catch {
		return false;
	}
}
function _getExceptionFromEvent(event) {
	return event.exception?.values?.[0];
}

// src/integrations/console.ts
const INTEGRATION_NAME$6 = "Console";
/**
* Captures calls to the `console` API as breadcrumbs in Sentry.
*
* By default the integration instruments `console.debug`, `console.info`, `console.warn`, `console.error`,
* `console.log`, `console.trace`, and `console.assert`. You can use the `levels` option to customize which
* levels are captured.
*
* @example
*
* ```js
* Sentry.init({
*   integrations: [Sentry.consoleIntegration({ levels: ['error', 'warn'] })],
* });
* ```
*/
const consoleIntegration = defineIntegration((options = {}) => {
	const levels = new Set(options.levels || CONSOLE_LEVELS);
	return {
		name: INTEGRATION_NAME$6,
		setup(client) {
			const unsubscribe = addConsoleInstrumentationHandler(({ args, level }) => {
				if (getClient() !== client || !levels.has(level)) return;
				addConsoleBreadcrumb(level, args);
			});
			client.registerCleanup(unsubscribe);
			if (options.filter) {
				const unsubscribe = addConsoleInstrumentationFilter(options.filter);
				client.registerCleanup(unsubscribe);
			}
		}
	};
});
/**
* Capture a console breadcrumb.
*
* Exported just for tests.
*/
function addConsoleBreadcrumb(level, args) {
	const breadcrumb = {
		category: "console",
		data: {
			arguments: args,
			logger: "console"
		},
		level: severityLevelFromString(level),
		message: formatConsoleArgs(args)
	};
	if (level === "assert") {
		if (args[0] === false) {
			const assertionArgs = args.slice(1);
			breadcrumb.message = assertionArgs.length > 0 ? `Assertion failed: ${formatConsoleArgs(assertionArgs)}` : "Assertion failed";
			breadcrumb.data.arguments = assertionArgs;
		} else return;
	}
	addBreadcrumb(breadcrumb, {
		input: args,
		level
	});
}
function formatConsoleArgs(values) {
	return "util" in GLOBAL_OBJ && typeof GLOBAL_OBJ.util.format === "function" ? GLOBAL_OBJ.util.format(...values) : safeJoin(values, " ");
}

// src/integrations/conversationId.ts
const INTEGRATION_NAME$5 = "ConversationId";
const _conversationIdIntegration = (() => {
	return {
		name: INTEGRATION_NAME$5,
		setup(client) {
			client.on("spanStart", (span) => {
				const scopeData = getCurrentScope().getScopeData();
				const isolationScopeData = getIsolationScope().getScopeData();
				const conversationId = scopeData.conversationId || isolationScopeData.conversationId;
				if (conversationId) {
					const { op, data: attributes, description: name } = spanToStaticSpanJSON(span);
					if (!op?.startsWith("gen_ai.") && !attributes["ai.operationId"] && !name?.startsWith("ai.")) return;
					span.setAttribute(Fr, conversationId);
				}
			});
		}
	};
});
/**
* Automatically applies conversation ID from scope to spans.
*
* This integration reads the conversation ID from the current or isolation scope
* and applies it to spans when they start. This ensures the conversation ID is
* available for all AI-related operations.
*/
const conversationIdIntegration = defineIntegration(_conversationIdIntegration);

// src/utils/supports.ts
const WINDOW$2 = GLOBAL_OBJ;
function _isFetchSupported() {
	if (!("fetch" in WINDOW$2)) return false;
	try {
		new Headers();
		new Request("data:,");
		new Response();
		return true;
	} catch {
		return false;
	}
}
/**
* isNative checks if the given function is a native implementation
*/
function isNativeFunction(func) {
	return func && /^function\s+\w+\(\)\s+\{\s+\[native code\]\s+\}$/.test(func.toString());
}
/**
* Tells whether current environment supports Fetch API natively
* {@link supportsNativeFetch}.
*
* @returns true if `window.fetch` is natively implemented, false otherwise
*/
function supportsNativeFetch() {
	if (typeof EdgeRuntime === "string") return true;
	if (!_isFetchSupported()) return false;
	if (isNativeFunction(WINDOW$2.fetch)) return true;
	let result = false;
	const doc = WINDOW$2.document;
	if (doc && typeof doc.createElement === "function") try {
		const sandbox = doc.createElement("iframe");
		sandbox.hidden = true;
		doc.head.appendChild(sandbox);
		if (sandbox.contentWindow?.fetch) result = isNativeFunction(sandbox.contentWindow.fetch);
		doc.head.removeChild(sandbox);
	} catch (err) {
		DEBUG_BUILD$2 && debug.warn("Could not create sandbox iframe for pure fetch check, bailing to window.fetch: ", err);
	}
	return result;
}

// src/instrument/fetch.ts
/**
* Add an instrumentation handler for when a fetch request happens.
* The handler function is called once when the request starts and once when it ends,
* which can be identified by checking if it has an `endTimestamp`.
* Returns a function to remove the handler.
*
* Use at your own risk, this might break without changelog notice, only used internally.
* @hidden
*/
function addFetchInstrumentationHandler(handler) {
	const type = "fetch";
	const removeHandler = addHandler(type, handler);
	maybeInstrument(type, () => instrumentFetch());
	return removeHandler;
}
function instrumentFetch(onFetchResolved) {
	if (isBrowser() && !supportsNativeFetch()) return;
	fill(GLOBAL_OBJ, "fetch", function(originalFetch) {
		return new Proxy(originalFetch, { apply(target, _thisArg, args) {
			const virtualError = /* @__PURE__ */ new Error();
			const { method, url } = parseFetchArgs(args);
			const handlerData = {
				args,
				fetchData: {
					method,
					url
				},
				startTimestamp: timestampInSeconds() * 1e3,
				virtualError,
				headers: getHeadersFromFetchArgs(args)
			};
			triggerHandlers("fetch", { ...handlerData });
			return Reflect.apply(target, GLOBAL_OBJ, args).then(async (response) => {
				triggerHandlers("fetch", {
					...handlerData,
					endTimestamp: timestampInSeconds() * 1e3,
					response
				});
				return response;
			}, (error) => {
				triggerHandlers("fetch", {
					...handlerData,
					endTimestamp: timestampInSeconds() * 1e3,
					error
				});
				if (isError(error) && error.stack === void 0) {
					error.stack = virtualError.stack;
					addNonEnumerableProperty(error, "framesToPop", 1);
				}
				const enhanceOption = getClient()?.getOptions().enhanceFetchErrorMessages ?? "always";
				if (enhanceOption !== false && isError(error) && error.name === "TypeError" && (error.message === "Failed to fetch" || error.message === "Load failed" || error.message === "NetworkError when attempting to fetch resource.")) try {
					const hostname = new URL(handlerData.fetchData.url, GLOBAL_OBJ.location?.href).host;
					if (hostname) {
						if (enhanceOption === "always") error.message = `${error.message} (${hostname})`;
						else addNonEnumerableProperty(error, "__sentry_fetch_url_host__", hostname);
					}
				} catch {}
				throw error;
			});
		} });
	});
}
function hasProp(obj, prop) {
	return isObjectLike(obj) && !!obj[prop];
}
function getUrlFromResource(resource) {
	if (typeof resource === "string") return resource;
	if (!resource) return "";
	if (hasProp(resource, "url")) return resource.url;
	if (resource.toString) return resource.toString();
	return "";
}
/**
* Parses the fetch arguments to find the used Http method and the url of the request.
* Exported for tests only.
*/
function parseFetchArgs(fetchArgs) {
	if (fetchArgs.length === 0) return {
		method: "GET",
		url: ""
	};
	if (fetchArgs.length === 2) {
		const [resource, options] = fetchArgs;
		return {
			url: getUrlFromResource(resource),
			method: hasProp(options, "method") ? String(options.method).toUpperCase() : isRequest(resource) && hasProp(resource, "method") ? String(resource.method).toUpperCase() : "GET"
		};
	}
	const arg = fetchArgs[0];
	return {
		url: getUrlFromResource(arg),
		method: hasProp(arg, "method") ? String(arg.method).toUpperCase() : "GET"
	};
}
function getHeadersFromFetchArgs(fetchArgs) {
	const [requestArgument, optionsArgument] = fetchArgs;
	try {
		if (typeof optionsArgument === "object" && optionsArgument !== null && "headers" in optionsArgument && optionsArgument.headers) return new Headers(optionsArgument.headers);
		if (isRequest(requestArgument)) return new Headers(requestArgument.headers);
	} catch {}
}

// src/utils/breadcrumb-log-level.ts
/**
* Determine a breadcrumb's log level (only `warning` or `error`) based on an HTTP status code.
*/
function getBreadcrumbLogLevelFromHttpStatusCode(statusCode) {
	if (statusCode === void 0) return;
	else if (statusCode >= 400 && statusCode < 500) return "warning";
	else if (statusCode >= 500) return "error";
	else return;
}

// src/debug-build.ts
/**
* This serves as a build time flag that will be true by default, but false in non-debug builds or if users replace `__SENTRY_DEBUG__` in their generated code.
*
* ATTENTION: This constant must never cross package boundaries (i.e. be exported) to guarantee that it can be used for tree shaking.
*/
const DEBUG_BUILD$1 = typeof __SENTRY_DEBUG__ === "undefined" || __SENTRY_DEBUG__;

// src/types.ts
const WINDOW$1 = GLOBAL_OBJ;

// src/htmlTreeAsString.ts
const DEFAULT_MAX_STRING_LENGTH = 80;
const accessors = {};
try {
	if (typeof Node !== "undefined") accessors.parentNode = Object.getOwnPropertyDescriptor(Node.prototype, "parentNode").get;
	if (typeof Element !== "undefined") {
		accessors.tagName = Object.getOwnPropertyDescriptor(Element.prototype, "tagName").get;
		accessors.id = Object.getOwnPropertyDescriptor(Element.prototype, "id").get;
		accessors.className = Object.getOwnPropertyDescriptor(Element.prototype, "className").get;
		accessors.getAttribute = Element.prototype.getAttribute;
	}
	if (typeof HTMLElement !== "undefined") accessors.dataset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "dataset").get;
} catch {}
function _safeRead(el, prop, arg) {
	const fn = accessors[prop];
	if (fn) try {
		return fn.call(el, arg);
	} catch {}
	const val = el[prop];
	return typeof val === "function" ? val.call(el, arg) : val;
}
/**
* Given a child DOM element, returns a query-selector statement describing that
* and its ancestors
* e.g. [HTMLElement] => body > div > input#foo.btn[name=baz]
* @returns generated DOM path
*/
function htmlTreeAsString(elem, options = {}) {
	if (!elem) return "<unknown>";
	try {
		let currentElem = elem;
		const MAX_TRAVERSE_HEIGHT = 5;
		const out = [];
		let height = 0;
		let len = 0;
		const separator = " > ";
		const sepLength = 3;
		let nextStr;
		const keyAttrs = Array.isArray(options) ? options : options.keyAttrs;
		const maskAttributeFn = Array.isArray(options) ? void 0 : options.maskAttributeFn;
		const maxStringLength = !Array.isArray(options) && options.maxStringLength || DEFAULT_MAX_STRING_LENGTH;
		while (currentElem && height++ < MAX_TRAVERSE_HEIGHT) {
			nextStr = _htmlElementAsString(currentElem, keyAttrs, maskAttributeFn);
			if (nextStr === "html" || height > 1 && len + out.length * sepLength + nextStr.length >= maxStringLength) break;
			out.push(nextStr);
			len += nextStr.length;
			currentElem = _safeRead(currentElem, "parentNode");
		}
		return out.reverse().join(separator);
	} catch {
		return "<unknown>";
	}
}
/**
* Returns a simple, query-selector representation of a DOM element
* e.g. [HTMLElement] => input#foo.btn[name=baz]
* @returns generated DOM path
*/
function _htmlElementAsString(el, keyAttrs, maskAttributeFn) {
	const out = [];
	const tagName = _safeRead(el, "tagName");
	if (!tagName) return "";
	if (typeof HTMLElement !== "undefined") {
		if (el instanceof HTMLElement) {
			const dataset = _safeRead(el, "dataset");
			if (dataset) {
				if (dataset["sentryComponent"]) return maskAttributeFn ? maskAttributeFn("data-sentry-component", dataset["sentryComponent"], el) : dataset["sentryComponent"];
				if (dataset["sentryElement"]) return maskAttributeFn ? maskAttributeFn("data-sentry-element", dataset["sentryElement"], el) : dataset["sentryElement"];
			}
		}
	}
	out.push(tagName.toLowerCase());
	const keyAttrPairs = keyAttrs?.length ? keyAttrs.filter((keyAttr) => _safeRead(el, "getAttribute", keyAttr)).map((keyAttr) => [keyAttr, _safeRead(el, "getAttribute", keyAttr)]) : null;
	if (keyAttrPairs?.length) keyAttrPairs.forEach(([key, value]) => {
		out.push(`[${key}="${maskAttributeFn && value ? maskAttributeFn(key, value, el) : value}"]`);
	});
	else {
		const id = _safeRead(el, "id");
		if (id) out.push(`#${maskAttributeFn ? maskAttributeFn("id", id, el) : id}`);
		const className = _safeRead(el, "className");
		if (className && isString(className)) {
			const classes = (maskAttributeFn ? maskAttributeFn("class", className, el) : className).split(/\s+/);
			for (const c of classes) out.push(`.${c}`);
		}
	}
	for (const k of [
		"aria-label",
		"type",
		"name",
		"title",
		"alt"
	]) {
		const attr = _safeRead(el, "getAttribute", k);
		if (attr) out.push(`[${k}="${maskAttributeFn ? maskAttributeFn(k, attr, el) : attr}"]`);
	}
	return out.join("");
}

// src/web-vitals/utils.ts
/**
* web-vitals 5.1.0 switched listeners to be added on the window rather than the document.
* Instead of having to check for window/document every time we add a listener, we can use this function.
*/
function addPageListener(type, listener, options) {
	if (WINDOW$1.document) WINDOW$1.addEventListener(type, listener, options);
}
/**
* web-vitals 5.1.0 switched listeners to be removed from the window rather than the document.
* Instead of having to check for window/document every time we remove a listener, we can use this function.
*/
function removePageListener(type, listener, options) {
	if (WINDOW$1.document) WINDOW$1.removeEventListener(type, listener, options);
}
/**
* Runs the passed callback during the next idle period, or immediately
* if the browser's visibility state is (or becomes) hidden.
*/
const whenIdleOrHidden = (cb) => {
	const rIC = WINDOW$1.requestIdleCallback || WINDOW$1.setTimeout;
	if (WINDOW$1.document?.visibilityState === "hidden") cb();
	else {
		let called = false;
		const runOnce = () => {
			if (!called) {
				cb();
				called = true;
			}
		};
		addPageListener("visibilitychange", runOnce, {
			once: true,
			capture: true
		});
		rIC(() => {
			runOnce();
			removePageListener("visibilitychange", runOnce, { capture: true });
		});
	}
};

// src/component-name.ts
/**
* Given a DOM element, traverses up the tree until it finds the first ancestor node
* that has the `data-sentry-component` or `data-sentry-element` attribute with `data-sentry-component` taking
* precedence. This attribute is added at build-time by projects that have the component name annotation plugin installed.
*
* @returns a string representation of the component for the provided DOM element, or `null` if not found
*/
function getComponentName(elem, maxTraverseHeight = 5) {
	if (!GLOBAL_OBJ.HTMLElement) return null;
	let currentElem = elem;
	for (let i = 0; i < maxTraverseHeight; i++) {
		if (!currentElem) return null;
		if (currentElem instanceof HTMLElement) {
			if (currentElem.dataset["sentryComponent"]) return currentElem.dataset["sentryComponent"];
			if (currentElem.dataset["sentryElement"]) return currentElem.dataset["sentryElement"];
		}
		currentElem = currentElem.parentNode;
	}
	return null;
}

// src/getLocationHref.ts
/**
* A safe form of location.href.
*/
function getLocationHref() {
	try {
		return WINDOW$1.document?.location.href ?? "";
	} catch {
		return "";
	}
}

// src/routing.ts
const CLIENT_ROUTE_PROVIDERS = /* @__PURE__ */ new WeakMap();
/**
* Registers the route provider for a client, replacing any previously registered one. `BrowserClient`
* calls this with its `routeProvider` option.
*
* Prefer the `routeProvider` option where the provider is known at `init`: the pageload span is named
* while `browserTracingIntegration` sets up, so a provider registered after `init` can only rename it
* after the fact.
*
* A client holds one provider. An app running two routers (a framework migration, or a shell plus an
* island) registers twice and the last one wins, so the first router's routes stop resolving.
*/
function setRouteProvider(provider, client = getClient()) {
	if (!client) {
		DEBUG_BUILD$1 && debug.warn("Cannot set a route provider without a client.");
		return;
	}
	if (DEBUG_BUILD$1 && getRouteProvider(client)) debug.warn("A route provider is already registered for this client and will be replaced. Routes only the previous provider knows about will no longer resolve.");
	CLIENT_ROUTE_PROVIDERS.set(client, provider);
}
/**
* Returns the route provider registered for a client.
*/
function getRouteProvider(client = getClient()) {
	return client && CLIENT_ROUTE_PROVIDERS.get(client);
}

// src/instrumentation/dom.ts
const DEBOUNCE_DURATION = 1e3;
let debounceTimerID;
let lastCapturedEventType;
let lastCapturedEventTargetId;
function getCapture(options) {
	return typeof options === "boolean" ? options : !!options?.capture;
}
/**
* Add an instrumentation handler for when a click or a keypress happens.
*
* Use at your own risk, this might break without changelog notice, only used internally.
* @hidden
*/
function addClickKeypressInstrumentationHandler(handler) {
	const type = "dom";
	addHandler(type, handler);
	maybeInstrument(type, instrumentDOM);
}
/** Exported for tests only. */
function instrumentDOM() {
	if (!WINDOW$1.document) return;
	const triggerDOMHandler = triggerHandlers.bind(null, "dom");
	const globalDOMEventHandler = makeDOMEventHandler(triggerDOMHandler, true);
	WINDOW$1.document.addEventListener("click", globalDOMEventHandler, false);
	WINDOW$1.document.addEventListener("keypress", globalDOMEventHandler, false);
	["EventTarget", "Node"].forEach((target) => {
		const proto = WINDOW$1[target]?.prototype;
		if (!proto?.hasOwnProperty?.("addEventListener")) return;
		fill(proto, "addEventListener", function(originalAddEventListener) {
			return function(type, listener, options) {
				if ((type === "click" || type == "keypress") && listener) try {
					const handlers = this.__sentry_instrumentation_handlers__ = this.__sentry_instrumentation_handlers__ || {};
					const handlerForType = handlers[type] = handlers[type] || {
						captureListeners: /* @__PURE__ */ new WeakSet(),
						bubbleListeners: /* @__PURE__ */ new WeakSet(),
						listenerCount: 0
					};
					const capture = getCapture(options);
					if (!handlerForType.handler) {
						const handler = makeDOMEventHandler(triggerDOMHandler);
						handlerForType.handler = handler;
						handlerForType.capture = capture;
						originalAddEventListener.call(this, type, handler, handlerForType.capture);
					}
					const listeners = handlerForType[capture ? "captureListeners" : "bubbleListeners"];
					if (!listeners.has(listener)) {
						if (typeof options === "object" && (options?.once || options?.signal)) handlerForType.sticky = true;
						else {
							listeners.add(listener);
							handlerForType.listenerCount++;
						}
					}
				} catch {}
				return originalAddEventListener.call(this, type, listener, options);
			};
		});
		fill(proto, "removeEventListener", function(originalRemoveEventListener) {
			return function(type, listener, options) {
				if ((type === "click" || type == "keypress") && listener) try {
					const handlers = this.__sentry_instrumentation_handlers__ || {};
					const handlerForType = handlers[type];
					if (handlerForType?.[getCapture(options) ? "captureListeners" : "bubbleListeners"].delete(listener)) {
						if (!--handlerForType.listenerCount && !handlerForType.sticky) {
							originalRemoveEventListener.call(this, type, handlerForType.handler, handlerForType.capture);
							handlerForType.handler = void 0;
							delete handlers[type];
						}
						if (Object.keys(handlers).length === 0) delete this.__sentry_instrumentation_handlers__;
					}
				} catch {}
				return originalRemoveEventListener.call(this, type, listener, options);
			};
		});
	});
}
/**
* Check whether the event is similar to the last captured one. For example, two click events on the same button.
*/
function isSimilarToLastCapturedEvent(event) {
	if (event.type !== lastCapturedEventType) return false;
	try {
		if (!event.target || event.target._sentryId !== lastCapturedEventTargetId) return false;
	} catch {}
	return true;
}
/**
* Decide whether an event should be captured.
* @param event event to be captured
*/
function shouldSkipDOMEvent(eventType, target) {
	if (eventType !== "keypress") return false;
	if (!target?.tagName) return true;
	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return false;
	return true;
}
/**
* Wraps addEventListener to capture UI breadcrumbs
*/
function makeDOMEventHandler(handler, globalListener = false) {
	return (event) => {
		if (!event || event["_sentryCaptured"]) return;
		const target = getEventTarget(event);
		if (shouldSkipDOMEvent(event.type, target)) return;
		addNonEnumerableProperty(event, "_sentryCaptured", true);
		if (target && !target._sentryId) addNonEnumerableProperty(target, "_sentryId", uuid4());
		const name = event.type === "keypress" ? "input" : event.type;
		if (!isSimilarToLastCapturedEvent(event)) {
			handler({
				event,
				name,
				global: globalListener
			});
			lastCapturedEventType = event.type;
			lastCapturedEventTargetId = target ? target._sentryId : void 0;
		}
		clearTimeout(debounceTimerID);
		debounceTimerID = WINDOW$1.setTimeout(() => {
			lastCapturedEventTargetId = void 0;
			lastCapturedEventType = void 0;
		}, DEBOUNCE_DURATION);
	};
}
function getEventTarget(event) {
	try {
		return event.target;
	} catch {
		return null;
	}
}

// src/instrumentation/history.ts
let lastHref;
/**
* Tells whether current environment supports History API
* {@link supportsHistory}.
*
* @returns Answer to the given question.
*/
function supportsHistory() {
	return "history" in WINDOW$1 && !!WINDOW$1.history;
}
/**
* Add an instrumentation handler for when a fetch request happens.
* The handler function is called once when the request starts and once when it ends,
* which can be identified by checking if it has an `endTimestamp`.
*
* Use at your own risk, this might break without changelog notice, only used internally.
* @hidden
*/
function addHistoryInstrumentationHandler(handler) {
	const type = "history";
	addHandler(type, handler);
	maybeInstrument(type, instrumentHistory);
}
/**
* Exported just for testing
*/
function instrumentHistory() {
	WINDOW$1.addEventListener("popstate", () => {
		const to = WINDOW$1.location.href;
		const from = lastHref;
		lastHref = to;
		if (from === to) return;
		triggerHandlers("history", {
			from,
			to
		});
	});
	if (!supportsHistory()) return;
	function historyReplacementFunction(originalHistoryFunction) {
		return function(...args) {
			const url = args.length > 2 ? args[2] : void 0;
			if (url) {
				const from = lastHref;
				const to = getAbsoluteUrl(String(url));
				lastHref = to;
				if (from === to) return originalHistoryFunction.apply(this, args);
				triggerHandlers("history", {
					from,
					to
				});
			}
			return originalHistoryFunction.apply(this, args);
		};
	}
	fill(WINDOW$1.history, "pushState", historyReplacementFunction);
	fill(WINDOW$1.history, "replaceState", historyReplacementFunction);
}
function getAbsoluteUrl(urlOrPath) {
	try {
		return new URL(urlOrPath, WINDOW$1.location.origin).toString();
	} catch {
		return urlOrPath;
	}
}

// src/getNativeImplementation.ts
const cachedImplementations = {};
/**
* Get the native implementation of a browser function.
*
* This can be used to ensure we get an unwrapped version of a function, in cases where a wrapped function can lead to problems.
*
* The following methods can be retrieved:
* - `setTimeout`: This can be wrapped by e.g. Angular, causing change detection to be triggered.
* - `fetch`: This can be wrapped by e.g. ad-blockers, causing an infinite loop when a request is blocked.
*/
function getNativeImplementation(name) {
	const cached = cachedImplementations[name];
	if (cached) return cached;
	let impl = WINDOW$1[name];
	if (isNativeFunction(impl)) return cachedImplementations[name] = impl.bind(WINDOW$1);
	const document = WINDOW$1.document;
	if (document && typeof document.createElement === "function") try {
		const sandbox = document.createElement("iframe");
		sandbox.hidden = true;
		document.head.appendChild(sandbox);
		const contentWindow = sandbox.contentWindow;
		if (contentWindow?.[name]) impl = contentWindow[name];
		document.head.removeChild(sandbox);
	} catch (e) {
		DEBUG_BUILD$1 && debug.warn(`Could not create sandbox iframe for ${name} check, bailing to window.${name}: `, e);
	}
	if (!impl) return impl;
	return cachedImplementations[name] = impl.bind(WINDOW$1);
}
/** Clear a cached implementation. */
function clearCachedImplementation(name) {
	cachedImplementations[name] = void 0;
}

// src/instrumentation/xhr.ts
const SENTRY_XHR_DATA_KEY = "__sentry_xhr_v3__";
/**
* Add an instrumentation handler for when an XHR request happens.
* The handler function is called once when the request starts and once when it ends,
* which can be identified by checking if it has an `endTimestamp`.
*
* Use at your own risk, this might break without changelog notice, only used internally.
* @hidden
*/
function addXhrInstrumentationHandler(handler) {
	const type = "xhr";
	addHandler(type, handler);
	maybeInstrument(type, instrumentXHR);
}
/** Exported only for tests. */
function instrumentXHR() {
	if (!WINDOW$1.XMLHttpRequest) return;
	const xhrproto = XMLHttpRequest.prototype;
	xhrproto.open = new Proxy(xhrproto.open, { apply(originalOpen, xhrOpenThisArg, xhrOpenArgArray) {
		let virtualError = /* @__PURE__ */ new Error();
		const startTimestamp = timestampInSeconds() * 1e3;
		const method = isString(xhrOpenArgArray[0]) ? xhrOpenArgArray[0].toUpperCase() : void 0;
		const url = parseXhrUrlArg(xhrOpenArgArray[1]);
		if (!method || url === void 0) return originalOpen.apply(xhrOpenThisArg, xhrOpenArgArray);
		xhrOpenThisArg[SENTRY_XHR_DATA_KEY] = {
			method,
			url,
			request_headers: {}
		};
		if (method === "POST" && url.match(/sentry_key/)) xhrOpenThisArg.__sentry_own_request__ = true;
		const onreadystatechangeHandler = () => {
			const xhrInfo = xhrOpenThisArg[SENTRY_XHR_DATA_KEY];
			if (!xhrInfo) return;
			if (xhrOpenThisArg.readyState === 4) {
				try {
					xhrInfo.status_code = xhrOpenThisArg.status;
				} catch {}
				const handlerData = {
					endTimestamp: timestampInSeconds() * 1e3,
					startTimestamp,
					xhr: xhrOpenThisArg,
					virtualError
				};
				triggerHandlers("xhr", handlerData);
				virtualError = void 0;
				xhrOpenThisArg.removeEventListener("readystatechange", onreadystatechangeHandler);
			}
		};
		if ("onreadystatechange" in xhrOpenThisArg && typeof xhrOpenThisArg.onreadystatechange === "function") xhrOpenThisArg.onreadystatechange = new Proxy(xhrOpenThisArg.onreadystatechange, { apply(originalOnreadystatechange, onreadystatechangeThisArg, onreadystatechangeArgArray) {
			onreadystatechangeHandler();
			return originalOnreadystatechange.apply(onreadystatechangeThisArg, onreadystatechangeArgArray);
		} });
		else xhrOpenThisArg.addEventListener("readystatechange", onreadystatechangeHandler);
		xhrOpenThisArg.setRequestHeader = new Proxy(xhrOpenThisArg.setRequestHeader, { apply(originalSetRequestHeader, setRequestHeaderThisArg, setRequestHeaderArgArray) {
			const [header, value] = setRequestHeaderArgArray;
			const xhrInfo = setRequestHeaderThisArg[SENTRY_XHR_DATA_KEY];
			if (xhrInfo && isString(header) && isString(value)) xhrInfo.request_headers[header.toLowerCase()] = value;
			return originalSetRequestHeader.apply(setRequestHeaderThisArg, setRequestHeaderArgArray);
		} });
		return originalOpen.apply(xhrOpenThisArg, xhrOpenArgArray);
	} });
	xhrproto.send = new Proxy(xhrproto.send, { apply(originalSend, sendThisArg, sendArgArray) {
		const sentryXhrData = sendThisArg[SENTRY_XHR_DATA_KEY];
		if (!sentryXhrData) return originalSend.apply(sendThisArg, sendArgArray);
		if (sendArgArray[0] !== void 0) sentryXhrData.body = sendArgArray[0];
		const handlerData = {
			startTimestamp: timestampInSeconds() * 1e3,
			xhr: sendThisArg
		};
		triggerHandlers("xhr", handlerData);
		return originalSend.apply(sendThisArg, sendArgArray);
	} });
}
/**
* Parses the URL argument of a XHR method to a string.
*
* See: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/open#url
* url: A string or any other object with a stringifier — including a URL object — that provides the URL of the resource to send the request to.
*
* @param url - The URL argument of an XHR method
* @returns The parsed URL string or undefined if the URL is invalid
*/
function parseXhrUrlArg(url) {
	if (isString(url)) return url;
	try {
		return url.toString();
	} catch {}
}

// src/is.ts
/**
* Checks whether given value's type is an Element instance.
*
* Returns false if `Element` is not available in the current runtime.
*/
function isElement(wat) {
	if (typeof Element === "undefined") return false;
	try {
		return wat instanceof Element;
	} catch {
		return false;
	}
}

// src/helpers.ts
const WINDOW = GLOBAL_OBJ;
let ignoreOnError = 0;
const ignoredErrorReports = [];
/**
* @hidden
*/
function shouldIgnoreOnError(data) {
	if (ignoreOnError > 0) return true;
	const index = data ? ignoredErrorReports.findIndex((report) => isSameErrorReport(report, data)) : -1;
	if (index === -1) return false;
	ignoredErrorReports.splice(index, 1);
	return true;
}
function isSameErrorReport(a, b) {
	return a.msg === b.msg && a.url === b.url && a.line === b.line && a.column === b.column;
}
/**
* @hidden
*/
function ignoreNextOnError() {
	ignoreOnError++;
	setTimeout(() => {
		ignoreOnError--;
	});
}
/**
* Instruments the given function and sends an event to Sentry every time the
* function throws an exception.
*
* @param fn A function to wrap. It is generally safe to pass an unbound function, because the returned wrapper always
* has a correct `this` context.
* @returns The wrapped function.
* @hidden
*/
function wrap(fn, options = {}) {
	function isFunction(fn) {
		return typeof fn === "function";
	}
	if (!isFunction(fn)) return fn;
	try {
		if (Object.prototype.hasOwnProperty.call(fn, "__sentry_wrapped__")) {
			const wrapper = fn.__sentry_wrapped__;
			if (typeof wrapper === "function") return wrapper;
			else return fn;
		}
		if (getOriginalFunction(fn)) return fn;
	} catch {
		return fn;
	}
	const sentryWrapped = function(...args) {
		GLOBAL_OBJ._sentryWrappedDepth = (GLOBAL_OBJ._sentryWrappedDepth || 0) + 1;
		try {
			const wrappedArguments = args.map((arg) => wrap(arg, options));
			return fn.apply(this, wrappedArguments);
		} catch (ex) {
			ignoreNextOnError();
			withScope((scope) => {
				scope.addEventProcessor((event) => {
					if (options.mechanism) {
						addExceptionTypeValue(event, void 0);
						addExceptionMechanism(event, options.mechanism);
					}
					event.extra = {
						...event.extra,
						arguments: args
					};
					return event;
				});
				captureException(ex);
			});
			throw ex;
		} finally {
			GLOBAL_OBJ._sentryWrappedDepth = (GLOBAL_OBJ._sentryWrappedDepth || 0) - 1;
		}
	};
	try {
		for (const property in fn) if (Object.prototype.hasOwnProperty.call(fn, property)) sentryWrapped[property] = fn[property];
	} catch {}
	markFunctionWrapped(sentryWrapped, fn);
	addNonEnumerableProperty(fn, "__sentry_wrapped__", sentryWrapped);
	try {
		if (Object.getOwnPropertyDescriptor(sentryWrapped, "name").configurable) Object.defineProperty(sentryWrapped, "name", { get() {
			return fn.name;
		} });
	} catch {}
	return sentryWrapped;
}
/**
* Get HTTP request data from the current page.
*
* The `Referer` header has `dataCollection.urlQueryParams` of `client` applied. `url` is unfiltered, so
* callers must pass it through `filterCollectedUrl`.
*/
function getHttpRequestData(client) {
	const url = getLocationHref();
	const { referrer } = WINDOW.document || {};
	const { userAgent } = WINDOW.navigator || {};
	return {
		url,
		headers: {
			...referrer && { Referer: filterCollectedUrl(referrer, client) },
			...userAgent && { "User-Agent": userAgent }
		}
	};
}

// src/eventbuilder.ts
/**
* This function creates an exception from a JavaScript Error
*/
function exceptionFromError(stackParser, ex) {
	const frames = parseStackFrames(stackParser, ex);
	const exception = {
		type: extractType(ex),
		value: extractMessage(ex)
	};
	if (frames.length) exception.stacktrace = { frames };
	if (exception.type === void 0 && exception.value === "") exception.value = "Unrecoverable error caught";
	return exception;
}
function eventFromPlainObject(stackParser, exception, syntheticException, isUnhandledRejection) {
	const normalizeDepth = getClient()?.getOptions().normalizeDepth;
	const errorFromProp = getErrorPropertyFromObject(exception);
	const extra = { __serialized__: normalizeToSize(exception, normalizeDepth) };
	if (errorFromProp) return {
		exception: { values: [exceptionFromError(stackParser, errorFromProp)] },
		extra
	};
	const event = {
		exception: { values: [{
			type: isEvent(exception) ? exception.constructor.name : isUnhandledRejection ? "UnhandledRejection" : "Error",
			value: getNonErrorObjectExceptionValue(exception, { isUnhandledRejection })
		}] },
		extra
	};
	if (syntheticException) {
		const frames = parseStackFrames(stackParser, syntheticException);
		if (frames.length) event.exception.values[0].stacktrace = { frames };
	}
	return event;
}
function eventFromError(stackParser, ex) {
	return { exception: { values: [exceptionFromError(stackParser, ex)] } };
}
/** Parses stack frames from an error */
function parseStackFrames(stackParser, ex) {
	const stacktrace = ex.stacktrace || ex.stack || "";
	const skipLines = getSkipFirstStackStringLines(ex);
	const framesToPop = getPopFirstTopFrames(ex);
	try {
		return stackParser(stacktrace, skipLines, framesToPop);
	} catch {}
	return [];
}
const reactMinifiedRegexp = /Minified React error #\d+;/i;
/**
* Certain known React errors contain links that would be falsely
* parsed as frames. This function check for these errors and
* returns number of the stack string lines to skip.
*/
function getSkipFirstStackStringLines(ex) {
	if (ex && reactMinifiedRegexp.test(ex.message)) return 1;
	return 0;
}
/**
* If error has `framesToPop` property, it means that the
* creator tells us the first x frames will be useless
* and should be discarded. Typically error from wrapper function
* which don't point to the actual location in the developer's code.
*
* Example: https://github.com/zertosh/invariant/blob/master/invariant.js#L46
*/
function getPopFirstTopFrames(ex) {
	if (typeof ex.framesToPop === "number") return ex.framesToPop;
	return 0;
}
function isWebAssemblyException(exception) {
	if (typeof WebAssembly !== "undefined" && typeof WebAssembly.Exception !== "undefined") return exception instanceof WebAssembly.Exception;
	else return false;
}
/**
* Extracts from errors what we use as the exception `type` in error events.
*
* Usually, this is the `name` property on Error objects but WASM errors need to be treated differently.
*/
function extractType(ex) {
	const name = ex?.name;
	if (!name && isWebAssemblyException(ex)) return ex.message && Array.isArray(ex.message) && ex.message.length == 2 ? ex.message[0] : "WebAssembly.Exception";
	return name;
}
/**
* There are cases where stacktrace.message is an Event object
* https://github.com/getsentry/sentry-javascript/issues/1949
* In this specific case we try to extract stacktrace.message.error.message
*/
function extractMessage(ex) {
	const message = ex?.message;
	if (isWebAssemblyException(ex)) {
		if (Array.isArray(ex.message) && ex.message.length == 2) return ex.message[1];
		return "wasm exception";
	}
	if (!message) return "No error message";
	if (message.error && typeof message.error.message === "string") return _enhanceErrorWithSentryInfo(message.error);
	return _enhanceErrorWithSentryInfo(ex);
}
/**
* Creates an {@link Event} from all inputs to `captureException` and non-primitive inputs to `captureMessage`.
* @hidden
*/
function eventFromException(stackParser, exception, hint, attachStacktrace) {
	const event = eventFromUnknownInput(stackParser, exception, hint?.syntheticException || void 0, attachStacktrace);
	addExceptionMechanism(event);
	event.level = "error";
	if (hint?.event_id) event.event_id = hint.event_id;
	return resolvedSyncPromise(event);
}
/**
* Builds and Event from a Message
* @hidden
*/
function eventFromMessage(stackParser, message, level = "info", hint, attachStacktrace) {
	const event = eventFromString(stackParser, message, hint?.syntheticException || void 0, attachStacktrace);
	event.level = level;
	if (hint?.event_id) event.event_id = hint.event_id;
	return resolvedSyncPromise(event);
}
/**
* @hidden
*/
function eventFromUnknownInput(stackParser, exception, syntheticException, attachStacktrace, isUnhandledRejection) {
	let event;
	if (isErrorEvent$1(exception) && exception.error) return eventFromError(stackParser, exception.error);
	if (isDOMError(exception) || isDOMException(exception)) {
		const domException = exception;
		if ("stack" in exception) {
			event = eventFromError(stackParser, exception);
			const firstException = event.exception?.values?.[0];
			if (attachStacktrace && syntheticException && firstException && !firstException.stacktrace) {
				const frames = parseStackFrames(stackParser, syntheticException);
				if (frames.length) {
					firstException.stacktrace = { frames };
					addExceptionMechanism(event, { synthetic: true });
				}
			}
		} else {
			const name = domException.name || (isDOMError(domException) ? "DOMError" : "DOMException");
			const message = domException.message ? `${name}: ${domException.message}` : name;
			event = eventFromString(stackParser, message, syntheticException, attachStacktrace);
			addExceptionTypeValue(event, message);
		}
		return event;
	}
	if (isError(exception)) return eventFromError(stackParser, exception);
	if (isPlainObject(exception) || isEvent(exception)) {
		event = eventFromPlainObject(stackParser, exception, syntheticException, isUnhandledRejection);
		addExceptionMechanism(event, { synthetic: true });
		return event;
	}
	const stringifiedException = String(exception);
	event = eventFromString(stackParser, stringifiedException, syntheticException, attachStacktrace);
	addExceptionTypeValue(event, stringifiedException);
	addExceptionMechanism(event, { synthetic: true });
	return event;
}
function eventFromString(stackParser, message, syntheticException, attachStacktrace) {
	const event = {};
	if (attachStacktrace && syntheticException) {
		const frames = parseStackFrames(stackParser, syntheticException);
		if (frames.length) event.exception = { values: [{
			value: message,
			stacktrace: { frames }
		}] };
		addExceptionMechanism(event, { synthetic: true });
	}
	if (isParameterizedString(message)) {
		const { __sentry_template_string__, __sentry_template_values__ } = message;
		event.logentry = {
			message: __sentry_template_string__,
			params: __sentry_template_values__
		};
		return event;
	}
	event.message = message;
	return event;
}
function getNonErrorObjectExceptionValue(exception, { isUnhandledRejection }) {
	const keys = extractExceptionKeysForMessage(exception);
	const captureType = isUnhandledRejection ? "promise rejection" : "exception";
	if (isErrorEvent$1(exception)) return `Event \`ErrorEvent\` captured as ${captureType} with message \`${exception.message}\``;
	if (isEvent(exception)) return `Event \`${getObjectClassName(exception)}\` (type=${exception.type}) captured as ${captureType}`;
	return `Object captured as ${captureType} with keys: ${keys}`;
}
function getObjectClassName(obj) {
	try {
		const prototype = Object.getPrototypeOf(obj);
		return prototype ? prototype.constructor.name : void 0;
	} catch {}
}
/** If a plain object has a property that is an `Error`, return this error. */
function getErrorPropertyFromObject(obj) {
	return Object.values(obj).find(isError);
}

// src/debug-build.ts
/**
* This serves as a build time flag that will be true by default, but false in non-debug builds or if users replace `__SENTRY_DEBUG__` in their generated code.
*
* ATTENTION: This constant must never cross package boundaries (i.e. be exported) to guarantee that it can be used for tree shaking.
*/
const DEBUG_BUILD = typeof __SENTRY_DEBUG__ === "undefined" || __SENTRY_DEBUG__;

// src/utils/managedTunnel.ts
/**
* Resolves `tunnel: true` or {@link BrowserTunnelOptions} to the managed tunnel's same-origin path. A string is left as
* written, so a tunnel the app serves itself keeps its URL.
*/
function resolveBrowserTunnelOption(options) {
	const { tunnel, dsn, transportOptions } = options;
	if (!tunnel) return {
		tunnel,
		transportOptions
	};
	if (typeof tunnel === "string") return {
		tunnel,
		transportOptions: isSameOrigin(tunnel) ? withEnvelopeContentType(transportOptions) : transportOptions
	};
	const tunnelOptions = tunnel === true ? {} : tunnel;
	const dsnComponents = dsn && makeDsn(dsn);
	const tunnelPath = tunnelOptions.path ?? (dsnComponents && getTunnelPath(dsnComponents));
	if (!tunnelPath) return {
		tunnel: void 0,
		transportOptions
	};
	const resolvedTunnel = `${normalizeTunnelBasePath(tunnelOptions.basePath)}${tunnelPath}${tunnelOptions.trailingSlash ? "/" : ""}`;
	DEBUG_BUILD && debug.log(`Tunneling events to "${resolvedTunnel}"`);
	return {
		tunnel: resolvedTunnel,
		transportOptions: withEnvelopeContentType(transportOptions)
	};
}
/**
* Sends envelopes as `application/x-sentry-envelope`. CSRF protection (SvelteKit, Astro) rejects the default
* `text/plain` POST as a form submission, and the Next.js managed tunnel route on Vercel matches on this header.
* Cross-origin it would trigger a CORS preflight, so only same-origin tunnels get it.
*/
function withEnvelopeContentType(transportOptions) {
	return {
		...transportOptions,
		headers: {
			"Content-Type": "application/x-sentry-envelope",
			...transportOptions?.headers
		}
	};
}
/**
* Whether the tunnel URL is on the page's origin. Unknown counts as cross-origin.
*/
function isSameOrigin(url) {
	const urlObject = parseStringToURLObject(url, WINDOW.location?.href);
	if (!urlObject) return false;
	return isURLObjectRelative(urlObject) || urlObject.origin === WINDOW.location?.origin;
}

// src/client.ts
/**
* The Sentry Browser SDK Client.
*
* @see BrowserOptions for documentation on configuration options.
* @see SentryClient for usage documentation.
*/
var BrowserClient = class extends Client {
	/**
	* Creates a new Browser SDK instance.
	*
	* @param options Configuration options for this SDK.
	*/
	constructor(options) {
		const opts = applyDefaultOptions({
			...options,
			...resolveBrowserTunnelOption(options)
		});
		const sdkSource = WINDOW.SENTRY_SDK_SOURCE || getSDKSource();
		applySdkMetadata(opts, "browser", ["browser"], sdkSource);
		super(opts);
		if (opts.routeProvider) setRouteProvider(opts.routeProvider, this);
		this._unhandledSessionStatus = "unhandled";
		const { userInfo } = this.getDataCollectionOptions();
		if (opts._metadata?.sdk) opts._metadata.sdk.settings = {
			infer_ip: userInfo ? "auto" : "never",
			...opts._metadata.sdk.settings
		};
		const { sendClientReports } = this._options;
		const checkDrift = () => {
			timestampInSeconds();
		};
		const listeners = [
			[
				WINDOW.document,
				"visibilitychange",
				() => {
					checkDrift();
					if (WINDOW.document.visibilityState === "hidden") {
						if (sendClientReports) this._flushOutcomes();
						queueMicrotask(() => {
							this.flush();
						});
					}
				}
			],
			[
				WINDOW.document,
				"freeze",
				checkDrift
			],
			[
				WINDOW.document,
				"resume",
				checkDrift
			],
			[
				WINDOW,
				"pagehide",
				checkDrift
			],
			[
				WINDOW,
				"pageshow",
				checkDrift
			]
		];
		listeners.forEach(([target, name, listener]) => target?.addEventListener?.(name, listener));
		this.on("close", () => listeners.forEach(([target, name, listener]) => target?.removeEventListener?.(name, listener)));
		if (userInfo) this.on("beforeSendSession", addAutoIpAddressToSession);
	}
	/**
	* @inheritDoc
	*/
	eventFromException(exception, hint) {
		return eventFromException(this._options.stackParser, exception, hint, this._options.attachStacktrace);
	}
	/**
	* @inheritDoc
	*/
	eventFromMessage(message, level = "info", hint) {
		return eventFromMessage(this._options.stackParser, message, level, hint, this._options.attachStacktrace);
	}
	/**
	* @inheritDoc
	*/
	_prepareEvent(event, hint, currentScope, isolationScope) {
		event.platform = event.platform || "javascript";
		return super._prepareEvent(event, hint, currentScope, isolationScope);
	}
};
/** Exported only for tests. */
function applyDefaultOptions(optionsArg) {
	return {
		release: typeof __SENTRY_RELEASE__ === "string" ? __SENTRY_RELEASE__ : WINDOW.SENTRY_RELEASE?.id,
		sendClientReports: true,
		parentSpanIsAlwaysRootSpan: true,
		...optionsArg
	};
}

// src/transports/fetch.ts
const DEFAULT_BROWSER_TRANSPORT_BUFFER_SIZE = 40;
/**
* Creates a Transport that uses the Fetch API to send events to Sentry.
*/
function makeFetchTransport(options, nativeFetch = getNativeImplementation("fetch")) {
	let pendingBodySize = 0;
	let pendingCount = 0;
	async function makeRequest(request) {
		const requestSize = request.body.length;
		pendingBodySize += requestSize;
		pendingCount++;
		const requestOptions = {
			body: request.body,
			method: "POST",
			referrerPolicy: "strict-origin",
			headers: options.headers,
			keepalive: pendingBodySize <= 6e4 && pendingCount < 15,
			...options.fetchOptions
		};
		try {
			const response = await nativeFetch(options.url, requestOptions);
			return {
				statusCode: response.status,
				headers: {
					"x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits"),
					"retry-after": response.headers.get("Retry-After")
				}
			};
		} catch (e) {
			clearCachedImplementation("fetch");
			throw e;
		} finally {
			pendingBodySize -= requestSize;
			pendingCount--;
		}
	}
	return createTransport(options, makeRequest, makePromiseBuffer(options.bufferSize || DEFAULT_BROWSER_TRANSPORT_BUFFER_SIZE));
}

const CHROME_PRIORITY = 30;
const GECKO_PRIORITY = 50;
function createFrame(filename, func, lineno, colno) {
	const frame = {
		filename,
		function: func === "<anonymous>" ? UNKNOWN_FUNCTION : func,
		in_app: true
	};
	if (lineno !== void 0) frame.lineno = lineno;
	if (colno !== void 0) frame.colno = colno;
	return frame;
}
const chromeRegexNoFnName = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
const chromeRegex = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?![^(]*\) )(?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const chromeEvalRegex = /\((\S*)(?::(\d+))(?::(\d+))\)/;
const chromeDataUriRegex = /at (.+?) ?\(data:(.+?),/;
const chromeStackParserFn = (line) => {
	const dataUriMatch = line.match(chromeDataUriRegex);
	if (dataUriMatch) return {
		filename: `<data:${dataUriMatch[2]}>`,
		function: dataUriMatch[1]
	};
	const noFnParts = chromeRegexNoFnName.exec(line);
	if (noFnParts) {
		const [, filename, line, col] = noFnParts;
		return createFrame(filename, UNKNOWN_FUNCTION, +line, +col);
	}
	const parts = chromeRegex.exec(line);
	if (parts) {
		if (parts[2]?.indexOf("eval") === 0) {
			const subMatch = chromeEvalRegex.exec(parts[2]);
			if (subMatch) {
				parts[2] = subMatch[1];
				parts[3] = subMatch[2];
				parts[4] = subMatch[3];
			}
		}
		const [func, filename] = extractSafariExtensionDetails(parts[1] || UNKNOWN_FUNCTION, parts[2]);
		return createFrame(filename, func, parts[3] ? +parts[3] : void 0, parts[4] ? +parts[4] : void 0);
	}
};
const chromeStackLineParser = [CHROME_PRIORITY, chromeStackParserFn];
const geckoREgex = /^\s*(.*?)(?:\(([^()]*)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
const geckoEvalRegex = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
const gecko = (line) => {
	const parts = geckoREgex.exec(line);
	if (parts) {
		if (parts[3] && parts[3].indexOf(" > eval") > -1) {
			const subMatch = geckoEvalRegex.exec(parts[3]);
			if (subMatch) {
				parts[1] = parts[1] || "eval";
				parts[3] = subMatch[1];
				parts[4] = subMatch[2];
				parts[5] = "";
			}
		}
		let filename = parts[3];
		let func = parts[1] || UNKNOWN_FUNCTION;
		[func, filename] = extractSafariExtensionDetails(func, filename);
		return createFrame(filename, func, parts[4] ? +parts[4] : void 0, parts[5] ? +parts[5] : void 0);
	}
};
const geckoStackLineParser = [GECKO_PRIORITY, gecko];
const defaultStackLineParsers = [chromeStackLineParser, geckoStackLineParser];
const defaultStackParser = createStackParser(...defaultStackLineParsers);
/**
* Safari web extensions, starting version unknown, can produce "frames-only" stacktraces.
* What it means, is that instead of format like:
*
* Error: wat
*   at function@url:row:col
*   at function@url:row:col
*   at function@url:row:col
*
* it produces something like:
*
*   function@url:row:col
*   function@url:row:col
*   function@url:row:col
*
* Because of that, it won't be captured by `chrome` RegExp and will fall into `Gecko` branch.
* This function is extracted so that we can use it in both places without duplicating the logic.
* Unfortunately "just" changing RegExp is too complicated now and making it pass all tests
* and fix this case seems like an impossible, or at least way too time-consuming task.
*/
const extractSafariExtensionDetails = (func, filename) => {
	const isSafariExtension = func.indexOf("safari-extension") !== -1;
	const isSafariWebExtension = func.indexOf("safari-web-extension") !== -1;
	return isSafariExtension || isSafariWebExtension ? [func.indexOf("@") !== -1 ? func.split("@")[0] : UNKNOWN_FUNCTION, isSafariExtension ? `safari-extension:${filename}` : `safari-web-extension:${filename}`] : [func, filename];
};

// src/integrations/breadcrumbs.ts
/** maxStringLength gets capped to prevent 100 breadcrumbs exceeding 1MB event payload size */
const MAX_ALLOWED_STRING_LENGTH = 1024;
const INTEGRATION_NAME$4 = "Breadcrumbs";
const _breadcrumbsIntegration = ((options = {}) => {
	const _options = {
		dom: true,
		fetch: true,
		history: true,
		sentry: true,
		xhr: true,
		...options
	};
	return {
		name: INTEGRATION_NAME$4,
		setup(client) {
			if (_options.dom) addClickKeypressInstrumentationHandler(_getDomBreadcrumbHandler(client, _options.dom));
			if (_options.xhr) addXhrInstrumentationHandler(_getXhrBreadcrumbHandler(client));
			if (_options.fetch) addFetchInstrumentationHandler(_getFetchBreadcrumbHandler(client));
			if (_options.history) addHistoryInstrumentationHandler(_getHistoryBreadcrumbHandler(client));
			if (_options.sentry) client.on("beforeSendEvent", _getSentryBreadcrumbHandler(client));
		}
	};
});
const breadcrumbsIntegration = defineIntegration(_breadcrumbsIntegration);
/**
* Adds a breadcrumb for Sentry events or transactions if this option is enabled.
*/
function _getSentryBreadcrumbHandler(client) {
	return function addSentryBreadcrumb(event) {
		if (getClient() !== client) return;
		addBreadcrumb({
			category: `sentry.${event.type === "transaction" ? "transaction" : "event"}`,
			event_id: event.event_id,
			level: event.level,
			message: getEventDescription(event)
		}, { event });
	};
}
/**
* A HOC that creates a function that creates breadcrumbs from DOM API calls.
* This is a HOC so that we get access to dom options in the closure.
*/
function _getDomBreadcrumbHandler(client, dom) {
	return function _innerDomBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		let target;
		let componentName;
		let keyAttrs = typeof dom === "object" ? dom.serializeAttribute : void 0;
		let maxStringLength = typeof dom === "object" && typeof dom.maxStringLength === "number" ? dom.maxStringLength : void 0;
		if (maxStringLength && maxStringLength > MAX_ALLOWED_STRING_LENGTH) {
			DEBUG_BUILD && debug.warn(`\`dom.maxStringLength\` cannot exceed ${MAX_ALLOWED_STRING_LENGTH}, but a value of ${maxStringLength} was configured. Sentry will use ${MAX_ALLOWED_STRING_LENGTH} instead.`);
			maxStringLength = MAX_ALLOWED_STRING_LENGTH;
		}
		if (typeof keyAttrs === "string") keyAttrs = [keyAttrs];
		try {
			const event = handlerData.event;
			const element = _isEvent(event) ? event.target : event;
			target = htmlTreeAsString(element, {
				keyAttrs,
				maxStringLength
			});
			componentName = getComponentName(element);
		} catch {
			target = "<unknown>";
		}
		if (target.length === 0) return;
		const breadcrumb = {
			category: `ui.${handlerData.name}`,
			message: target
		};
		if (componentName) breadcrumb.data = { "ui.component_name": componentName };
		addBreadcrumb(breadcrumb, {
			event: handlerData.event,
			name: handlerData.name,
			global: handlerData.global
		});
	};
}
/**
* Creates breadcrumbs from XHR API calls
*/
function _getXhrBreadcrumbHandler(client) {
	return function _xhrBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		const { startTimestamp, endTimestamp } = handlerData;
		const sentryXhrData = handlerData.xhr[SENTRY_XHR_DATA_KEY];
		if (!startTimestamp || !endTimestamp || !sentryXhrData) return;
		const { method, url, status_code, body } = sentryXhrData;
		const data = {
			method,
			url: getBreadcrumbUrl(url, client),
			status_code
		};
		const hint = {
			xhr: handlerData.xhr,
			input: body,
			startTimestamp,
			endTimestamp
		};
		const breadcrumb = {
			category: "xhr",
			data,
			type: "http",
			level: getBreadcrumbLogLevelFromHttpStatusCode(status_code)
		};
		client.emit("beforeOutgoingRequestBreadcrumb", breadcrumb, hint);
		addBreadcrumb(breadcrumb, hint);
	};
}
/**
* Creates breadcrumbs from fetch API calls
*/
function _getFetchBreadcrumbHandler(client) {
	return function _fetchBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		const { startTimestamp, endTimestamp } = handlerData;
		if (!endTimestamp) return;
		if (handlerData.fetchData.url.match(/sentry_key/) && handlerData.fetchData.method === "POST") return;
		if (handlerData.error) {
			const hint = {
				data: handlerData.error,
				input: handlerData.args,
				startTimestamp,
				endTimestamp
			};
			const breadcrumb = {
				category: "fetch",
				data: {
					...handlerData.fetchData,
					url: getBreadcrumbUrl(handlerData.fetchData.url, client)
				},
				level: "error",
				type: "http"
			};
			client.emit("beforeOutgoingRequestBreadcrumb", breadcrumb, hint);
			addBreadcrumb(breadcrumb, hint);
		} else {
			const response = handlerData.response;
			const data = {
				...handlerData.fetchData,
				url: getBreadcrumbUrl(handlerData.fetchData.url, client),
				status_code: response?.status
			};
			const hint = {
				input: handlerData.args,
				response,
				startTimestamp,
				endTimestamp
			};
			const breadcrumb = {
				category: "fetch",
				data,
				type: "http",
				level: getBreadcrumbLogLevelFromHttpStatusCode(data.status_code)
			};
			client.emit("beforeOutgoingRequestBreadcrumb", breadcrumb, hint);
			addBreadcrumb(breadcrumb, hint);
		}
	};
}
/**
* Creates breadcrumbs from history API calls
*/
function _getHistoryBreadcrumbHandler(client) {
	return function _historyBreadcrumb(handlerData) {
		if (getClient() !== client) return;
		let from = handlerData.from;
		let to = handlerData.to;
		const parsedLoc = parseUrl(WINDOW.location.href);
		let parsedFrom = from ? parseUrl(from) : void 0;
		const parsedTo = parseUrl(to);
		if (!parsedFrom?.path) parsedFrom = parsedLoc;
		if (parsedLoc.protocol === parsedTo.protocol && parsedLoc.host === parsedTo.host) to = parsedTo.relative;
		if (parsedLoc.protocol === parsedFrom.protocol && parsedLoc.host === parsedFrom.host) from = parsedFrom.relative;
		addBreadcrumb({
			category: "navigation",
			data: {
				from: filterCollectedUrl(from),
				to: filterCollectedUrl(to)
			}
		});
	};
}
function getBreadcrumbUrl(url, client) {
	const pageUrl = url === "" ? WINDOW.location?.href : void 0;
	return filterCollectedUrl(pageUrl ? pageUrl.split("#")[0] ?? "" : url, client);
}
function _isEvent(event) {
	return !!event && !!event.target;
}

// src/integrations/browserapierrors.ts
const DEFAULT_EVENT_TARGET = "EventTarget,Window,Node,ApplicationCache,AudioTrackList,BroadcastChannel,ChannelMergerNode,CryptoOperation,EventSource,FileReader,HTMLUnknownElement,IDBDatabase,IDBRequest,IDBTransaction,KeyOperation,MediaController,MessagePort,ModalWindow,Notification,SVGElementInstance,Screen,SharedWorker,TextTrack,TextTrackCue,TextTrackList,WebSocket,WebSocketWorker,Worker,XMLHttpRequest,XMLHttpRequestEventTarget,XMLHttpRequestUpload".split(",");
const INTEGRATION_NAME$3 = "BrowserApiErrors";
const _browserApiErrorsIntegration = ((options = {}) => {
	const _options = {
		XMLHttpRequest: true,
		eventTarget: true,
		requestAnimationFrame: true,
		setInterval: true,
		setTimeout: true,
		unregisterOriginalCallbacks: false,
		...options
	};
	return {
		name: INTEGRATION_NAME$3,
		setupOnce() {
			if (_options.setTimeout) fill(WINDOW, "setTimeout", _wrapTimeFunction);
			if (_options.setInterval) fill(WINDOW, "setInterval", _wrapTimeFunction);
			if (_options.requestAnimationFrame) fill(WINDOW, "requestAnimationFrame", _wrapRAF);
			if (_options.XMLHttpRequest && "XMLHttpRequest" in WINDOW) fill(XMLHttpRequest.prototype, "send", _wrapXHR);
			const eventTargetOption = _options.eventTarget;
			if (eventTargetOption) (Array.isArray(eventTargetOption) ? eventTargetOption : DEFAULT_EVENT_TARGET).forEach((target) => _wrapEventTarget(target, _options));
		}
	};
});
/**
* Wrap timer functions and event targets to catch errors and provide better meta data.
*/
const browserApiErrorsIntegration = defineIntegration(_browserApiErrorsIntegration);
function _wrapTimeFunction(original) {
	return function(...args) {
		const originalCallback = args[0];
		args[0] = wrap(originalCallback, { mechanism: {
			handled: false,
			type: `auto.browser.browserapierrors.${getFunctionName(original)}`
		} });
		return original.apply(this, args);
	};
}
function _wrapRAF(original) {
	return function(callback) {
		return original.apply(this, [wrap(callback, { mechanism: {
			data: { handler: getFunctionName(original) },
			handled: false,
			type: "auto.browser.browserapierrors.requestAnimationFrame"
		} })]);
	};
}
function _wrapXHR(originalSend) {
	return function(...args) {
		const xhr = this;
		[
			"onload",
			"onerror",
			"onprogress",
			"onreadystatechange"
		].forEach((prop) => {
			if (prop in xhr && typeof xhr[prop] === "function") fill(xhr, prop, function(original) {
				const wrapOptions = { mechanism: {
					data: { handler: getFunctionName(original) },
					handled: false,
					type: `auto.browser.browserapierrors.xhr.${prop}`
				} };
				const originalFunction = getOriginalFunction(original);
				if (originalFunction) wrapOptions.mechanism.data.handler = getFunctionName(originalFunction);
				return wrap(original, wrapOptions);
			});
		});
		return originalSend.apply(this, args);
	};
}
function _wrapEventTarget(target, integrationOptions) {
	const proto = WINDOW[target]?.prototype;
	if (!proto?.hasOwnProperty?.("addEventListener")) return;
	fill(proto, "addEventListener", function(original) {
		return function(eventName, fn, options) {
			try {
				if (isEventListenerObject(fn)) fn.handleEvent = wrap(fn.handleEvent, { mechanism: {
					data: {
						handler: getFunctionName(fn),
						target
					},
					handled: false,
					type: "auto.browser.browserapierrors.handleEvent"
				} });
			} catch {}
			if (integrationOptions.unregisterOriginalCallbacks) unregisterOriginalCallback(this, eventName, fn);
			return original.apply(this, [
				eventName,
				wrap(fn, { mechanism: {
					data: {
						handler: getFunctionName(fn),
						target
					},
					handled: false,
					type: "auto.browser.browserapierrors.addEventListener"
				} }),
				options
			]);
		};
	});
	fill(proto, "removeEventListener", function(originalRemoveEventListener) {
		return function(eventName, fn, options) {
			/**
			* There are 2 possible scenarios here:
			*
			* 1. Someone passes a callback, which was attached prior to Sentry initialization, or by using unmodified
			* method, eg. `document.addEventListener.call(el, name, handler). In this case, we treat this function
			* as a pass-through, and call original `removeEventListener` with it.
			*
			* 2. Someone passes a callback, which was attached after Sentry was initialized, which means that it was using
			* our wrapped version of `addEventListener`, which internally calls `wrap` helper.
			* This helper "wraps" whole callback inside a try/catch statement, and attached appropriate metadata to it,
			* in order for us to make a distinction between wrapped/non-wrapped functions possible.
			* If a function was wrapped, it has additional property of `__sentry_wrapped__`, holding the handler.
			*
			* When someone adds a handler prior to initialization, and then do it again, but after,
			* then we have to detach both of them. Otherwise, if we'd detach only wrapped one, it'd be impossible
			* to get rid of the initial handler and it'd stick there forever.
			*/
			try {
				if (Object.prototype.hasOwnProperty.call(fn, "__sentry_wrapped__")) {
					const originalEventHandler = fn.__sentry_wrapped__;
					if (originalEventHandler) originalRemoveEventListener.call(this, eventName, originalEventHandler, options);
				}
			} catch {}
			return originalRemoveEventListener.call(this, eventName, fn, options);
		};
	});
}
function isEventListenerObject(obj) {
	return typeof obj.handleEvent === "function";
}
function unregisterOriginalCallback(target, eventName, fn) {
	if (target && typeof target === "object" && "removeEventListener" in target && typeof target.removeEventListener === "function") target.removeEventListener(eventName, fn);
}

// src/integrations/browsersession.ts
/**
* When added, automatically creates sessions which allow you to track adoption and crashes (crash free rate) in your Releases in Sentry.
* More information: https://docs.sentry.io/product/releases/health/
*
* Note: In order for session tracking to work, you need to set up Releases: https://docs.sentry.io/product/releases/
*/
const browserSessionIntegration = defineIntegration((options = {}) => {
	const lifecycle = options.lifecycle ?? "page";
	return {
		name: "BrowserSession",
		setupOnce() {
			if (typeof WINDOW.document === "undefined") {
				DEBUG_BUILD && debug.warn("Using the `browserSessionIntegration` in non-browser environments is not supported.");
				return;
			}
			startSession({ ignoreDuration: true });
			let initialSessionSent = false;
			whenIdleOrHidden(() => {
				if (!initialSessionSent) {
					captureSession();
					initialSessionSent = true;
				}
			});
			const isolationScope = getIsolationScope();
			let previousUser = isolationScope.getUser();
			isolationScope.addScopeListener((scope) => {
				const maybeNewUser = scope.getUser();
				if (previousUser?.id !== maybeNewUser?.id || previousUser?.ip_address !== maybeNewUser?.ip_address) {
					previousUser = maybeNewUser;
					if (initialSessionSent) captureSession();
				}
			});
			if (lifecycle === "route") addHistoryInstrumentationHandler(({ from, to }) => {
				if (from !== to) {
					startSession({ ignoreDuration: true });
					captureSession();
					initialSessionSent = true;
				}
			});
		}
	};
});

// src/integrations/culturecontext.ts
const INTEGRATION_NAME$2 = "CultureContext";
const _cultureContextIntegration = (() => {
	return {
		name: INTEGRATION_NAME$2,
		preprocessEvent(event) {
			const culture = getCultureContext();
			if (culture) event.contexts = {
				...event.contexts,
				culture: {
					...culture,
					...event.contexts?.culture
				}
			};
		},
		processSegmentSpan(span) {
			const culture = getCultureContext();
			if (culture) safeSetSpanJSONAttributes(span, {
				[Ra]: culture.locale,
				[Na]: culture.timezone,
				[wa]: culture.calendar
			});
		}
	};
});
/**
* Captures culture context from the browser.
*
* Enabled by default.
*
* @example
* ```js
* import * as Sentry from '@sentry/browser';
*
* Sentry.init({
*   integrations: [Sentry.cultureContextIntegration()],
* });
* ```
*/
const cultureContextIntegration = defineIntegration(_cultureContextIntegration);
/**
* Returns the culture context from the browser's Intl API.
*/
function getCultureContext() {
	try {
		const intl = WINDOW.Intl;
		if (!intl) return;
		const options = intl.DateTimeFormat().resolvedOptions();
		return {
			locale: options.locale,
			timezone: options.timeZone,
			calendar: options.calendar
		};
	} catch {
		return;
	}
}

// src/integrations/globalhandlers.ts
const INTEGRATION_NAME$1 = "GlobalHandlers";
const _globalHandlersIntegration = ((options = {}) => {
	const _options = {
		onerror: true,
		onunhandledrejection: true,
		...options
	};
	return {
		name: INTEGRATION_NAME$1,
		setupOnce() {
			Error.stackTraceLimit = 50;
		},
		setup(client) {
			if (_options.onerror) {
				_installGlobalOnErrorHandler(client);
				globalHandlerLog("onerror");
			}
			if (_options.onunhandledrejection) {
				_installGlobalOnUnhandledRejectionHandler(client);
				globalHandlerLog("onunhandledrejection");
			}
		}
	};
});
const globalHandlersIntegration = defineIntegration(_globalHandlersIntegration);
function _installGlobalOnErrorHandler(client) {
	addGlobalErrorInstrumentationHandler((data) => {
		const { stackParser, attachStacktrace } = getOptions();
		if (getClient() !== client || shouldIgnoreOnError(data)) return;
		const { msg, url, line, column, error } = data;
		const event = _enhanceEventWithInitialFrame(eventFromUnknownInput(stackParser, error || msg, void 0, attachStacktrace, false), url, line, column);
		event.level = "error";
		captureEvent(event, {
			originalException: error,
			mechanism: {
				handled: false,
				type: "auto.browser.global_handlers.onerror"
			}
		});
	});
}
function _installGlobalOnUnhandledRejectionHandler(client) {
	addGlobalUnhandledRejectionInstrumentationHandler((e) => {
		const { stackParser, attachStacktrace } = getOptions();
		if (getClient() !== client || shouldIgnoreOnError()) return;
		const error = _getUnhandledRejectionError(e);
		const event = isPrimitive(error) ? _eventFromRejectionWithPrimitive(error) : eventFromUnknownInput(stackParser, error, void 0, attachStacktrace, true);
		event.level = "error";
		captureEvent(event, {
			originalException: error,
			mechanism: {
				handled: false,
				type: "auto.browser.global_handlers.onunhandledrejection"
			}
		});
	});
}
/**
*
*/
function _getUnhandledRejectionError(error) {
	if (isPrimitive(error)) return error;
	try {
		if ("reason" in error) return error.reason;
		if ("detail" in error && "reason" in error.detail) return error.detail.reason;
	} catch {}
	return error;
}
/**
* Create an event from a promise rejection where the `reason` is a primitive.
*
* @param reason: The `reason` property of the promise rejection
* @returns An Event object with an appropriate `exception` value
*/
function _eventFromRejectionWithPrimitive(reason) {
	return { exception: { values: [{
		type: "UnhandledRejection",
		value: `Non-Error promise rejection captured with value: ${String(reason)}`
	}] } };
}
/**
* Adds a frame built from the error location when the event has none.
*/
function _enhanceEventWithInitialFrame(event, url, lineno, colno) {
	const e = event.exception = event.exception || {};
	const ev = e.values = e.values || [];
	const ev0 = ev[0] = ev[0] || {};
	const ev0s = ev0.stacktrace = ev0.stacktrace || {};
	const ev0sf = ev0s.frames = ev0s.frames || [];
	if (ev0sf.length === 0) ev0sf.push({
		colno,
		lineno,
		filename: getFilenameFromUrl(url) ?? getLocationHref(),
		function: UNKNOWN_FUNCTION,
		in_app: true
	});
	return event;
}
function globalHandlerLog(type) {
	DEBUG_BUILD && debug.log(`Global Handler attached: ${type}`);
}
function getOptions() {
	return getClient()?.getOptions() || {
		stackParser: () => [],
		attachStacktrace: false
	};
}
function getFilenameFromUrl(url) {
	if (!isString(url) || url.length === 0) return;
	if (url.startsWith("data:")) return `<${stripDataUrlContent(url, false)}>`;
	return url;
}

// src/integrations/httpcontext.ts
/**
* Collects information about HTTP request headers and
* attaches them to the event.
*/
const httpContextIntegration = defineIntegration(() => {
	return {
		name: "HttpContext",
		preprocessEvent(event, _hint, client) {
			if (!WINDOW.navigator && !WINDOW.location && !WINDOW.document) return;
			const { url, headers: collectedHeaders } = getHttpRequestData(client);
			const behavior = client.getDataCollectionOptions().httpHeaders.request;
			const userHeaders = Object.entries(event.request?.headers ?? {}).filter(([key]) => !(key in collectedHeaders));
			const headers = {
				...filterKeyValueData(collectedHeaders, behavior),
				...Object.fromEntries(userHeaders)
			};
			event.request = {
				url: filterCollectedUrl(url, client),
				...event.request,
				...Object.keys(headers).length > 0 ? { headers } : { headers: void 0 }
			};
		},
		processSpan(span, client) {
			if (!WINDOW.navigator && !WINDOW.location && !WINDOW.document) return;
			const reqData = getHttpRequestData(client);
			const headers = filterKeyValueData(reqData.headers, client.getDataCollectionOptions().httpHeaders.request);
			const referer = headers["Referer"];
			const { hostname, protocol } = WINDOW.location || {};
			safeSetSpanJSONAttributes(span, {
				[vy]: headers["User-Agent"],
				[$m]: protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || !!hostname?.endsWith(".localhost"),
				...span.is_segment && {
					[py]: span.attributes?.[yb] !== "http.client" ? filterCollectedUrl(reqData.url) : void 0,
					[`${cl}.referer`]: referer ? [referer] : void 0
				}
			});
		}
	};
});

// src/integrations/linkederrors.ts
const DEFAULT_KEY = "cause";
const DEFAULT_LIMIT = 5;
const INTEGRATION_NAME = "LinkedErrors";
const _linkedErrorsIntegration = ((options = {}) => {
	const limit = options.limit || DEFAULT_LIMIT;
	const key = options.key || DEFAULT_KEY;
	return {
		name: INTEGRATION_NAME,
		preprocessEvent(event, hint, client) {
			const options = client.getOptions();
			applyAggregateErrorsToEvent(exceptionFromError, options.stackParser, key, limit, event, hint);
		}
	};
});
/**
* Aggregrate linked errors in an event.
*/
const linkedErrorsIntegration = defineIntegration(_linkedErrorsIntegration);

// src/normalizeStringifyValue.ts
const HTML_ELEMENT_CONSTRUCTOR_NAME_REGEX = /^HTML(\w*)Element$/;
/**
* Browser-specific contributions to `normalize()`'s `stringifyValue`. Plug into
* `setNormalizeStringifier` from the browser SDK so DOM values get a useful string
* representation without forcing core to carry the DOM-specific code.
*
* Handles:
* - `window` → `[Window]`
* - `document` → `[Document]`
* - `HTMLElement` subclasses → `[HTMLElement: <css-selector-path>]` (via `htmlTreeAsString`)
*
* Vue ViewModels and React SyntheticEvents are not handled here — the Vue and React
* SDKs wrap this function in their `init` and add their own checks on top.
*/
function normalizeStringifyValue(value) {
	if (typeof window !== "undefined" && value === window) return "[Window]";
	if (typeof document !== "undefined" && value === document) return "[Document]";
	if (isElement(value)) {
		const objName = getConstructorName(value);
		if (HTML_ELEMENT_CONSTRUCTOR_NAME_REGEX.test(objName)) return `[HTMLElement: ${htmlTreeAsString(value)}]`;
	}
}
function getConstructorName(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype?.constructor ? prototype.constructor.name : "null prototype";
}

// src/utils/detectBrowserExtension.ts
/**
* Returns true if the SDK is running in an embedded browser extension.
* Stand-alone browser extensions (which do not share the same data as the main browser page) are fine.
*/
function checkAndWarnIfIsEmbeddedBrowserExtension() {
	if (_isEmbeddedBrowserExtension()) {
		if (DEBUG_BUILD) consoleSandbox(() => {
			console.error("[Sentry] You cannot use Sentry.init() in a browser extension, see: https://docs.sentry.io/platforms/javascript/best-practices/browser-extensions/");
		});
		return true;
	}
	return false;
}
function _isEmbeddedBrowserExtension() {
	if (typeof WINDOW.window === "undefined") return false;
	const _window = WINDOW;
	if (_window.nw) return false;
	if (!(_window["chrome"] || _window["browser"])?.runtime?.id) return false;
	const href = getLocationHref();
	return !(WINDOW === WINDOW.top && /^(?:chrome-extension|moz-extension|ms-browser-extension|safari-web-extension):\/\//.test(href));
}

// src/sdk.ts
/** Get the default integrations for the browser SDK. */
function getDefaultIntegrations(_options) {
	/**
	* Note: Please make sure this stays in sync with Angular SDK, which re-exports
	* `getDefaultIntegrations` but with an adjusted set of integrations.
	*/
	return [
		eventFiltersIntegration(),
		functionToStringIntegration(),
		conversationIdIntegration(),
		browserApiErrorsIntegration(),
		breadcrumbsIntegration(),
		consoleIntegration(),
		globalHandlersIntegration(),
		linkedErrorsIntegration(),
		dedupeIntegration(),
		httpContextIntegration(),
		cultureContextIntegration(),
		browserSessionIntegration()
	];
}
/**
* The Sentry Browser SDK Client.
*
* To use this SDK, call the {@link init} function as early as possible when
* loading the web page. To set context information or send manual events, use
* the provided methods.
*
* @example
*
* ```
*
* import { init } from '@sentry/browser';
*
* init({
*   dsn: '__DSN__',
*   // ...
* });
* ```
*
* @example
* ```
*
* import { addBreadcrumb } from '@sentry/browser';
* addBreadcrumb({
*   message: 'My Breadcrumb',
*   // ...
* });
* ```
*
* @example
*
* ```
*
* import * as Sentry from '@sentry/browser';
* Sentry.captureMessage('Hello, world!');
* Sentry.captureException(new Error('Good bye'));
* Sentry.captureEvent({
*   message: 'Manual',
*   stacktrace: [
*     // ...
*   ],
* });
* ```
*
* @see {@link BrowserOptions} for documentation on configuration options.
*/
function init(userOptions = {}) {
	const options = captureOptionsSetByUser(userOptions);
	const shouldDisableBecauseIsBrowserExtenstion = !options.skipBrowserExtensionCheck && checkAndWarnIfIsEmbeddedBrowserExtension();
	let defaultIntegrations = options.defaultIntegrations == null ? getDefaultIntegrations() : options.defaultIntegrations;
	const integrations = getIntegrationsToSetup({
		integrations: options.integrations,
		defaultIntegrations
	});
	const clientOptions = {
		...options,
		...resolveBrowserTunnelOption(options),
		enabled: shouldDisableBecauseIsBrowserExtenstion ? false : options.enabled,
		stackParser: stackParserFromStackParserOptions(options.stackParser || defaultStackParser),
		integrations,
		transport: options.transport || makeFetchTransport
	};
	setNormalizeStringifier(normalizeStringifyValue);
	return initAndBind(BrowserClient, clientOptions);
}

export { captureMessage, flush, init, setTag };
//# sourceMappingURL=error-tracking-sdk-DTgqvmXy.js.map
