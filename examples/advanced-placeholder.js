import util from 'util';

const isPlaceholder = Symbol('@placeholder');
const placeholderPath = Symbol('@path');

const noop = (path) => {
    const newNoop = () => {};
    newNoop[isPlaceholder] = true;
    newNoop[placeholderPath] = newNoop.path = path;

    return newNoop;
};

export const $this = Symbol('$this');
export const $rest = Symbol('$rest');
export const $$rest = Symbol('...$rest');
export const $all = Symbol('$all');

const asKey = (value) => {
    if (typeof value === 'string') {
        if (/^[$_a-z][$_a-z0-9]*$/.test(value)) {
            return `.${value}`;
        }

        return `['${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}']`;
    }

    return `[${value.toString()}]`;
};

const toString = (path) => {
    if (!path.length) {
        return '$';
    }

    if (path[0] === 0) {
        return `_${path.slice(1).map(asKey).join('')}`;
    }

    return `$${path[0].toString()}${path.slice(1).map(asKey).join('')}`;
};

export class ResolutionError extends Error {}

const resolve = (obj, path, original = path) => {
    if (!path.length) {
        return obj;
    }

    if (obj === undefined) {
        throw new ResolutionError(`${toString(path)} not accessible in ${util.inspect(obj)}`);
    }

    try {
        const [key, ...keys] = path;

        if (key === $all) {
            if (!(obj instanceof Array)) {
                throw TypeError(`Object at ${toString(original)} key $all must refer to Array.`);
            }

            return obj.map(entry => resolve(entry, keys, original));
        } else {
            return resolve(obj[key], keys, original);
        }
    } catch(e) {
        if (e instanceof ResolutionError) {
            throw new ResolutionError(`${toString(path)} not accessible in ${util.inspect(obj)}`);
        } else {
            throw e;
        }
    }
};

const apply = (thisArg, fn, ...args) => (...calledWith) => {
    let maxUsed = Math.max(thisArg[placeholderPath][0], fn[placeholderPath][0]);

    const resolvedFn = resolve(calledWith, fn[placeholderPath]);
    const resolvedThisArg = resolve(calledWith, thisArg[placeholderPath]);

    function applyTo(realThisArg, realFn, ...realArgs) {
        return realFn.apply(realThisArg, args.map(arg => {
            if (arg === $rest || arg === $$rest) {
                return arg;
            }
    
            if (arg === $this) {
                return realThisArg;
            }
    
            if (arg[isPlaceholder]) {
                maxUsed = arg[placeholderPath][0] > maxUsed ? arg[placeholderPath][0] : maxUsed;
                return resolve(realArgs, arg[placeholderPath]);
            }
    
            return arg;
        }).reduce((args, arg) => {
            if (arg === $$rest) {
                args.push(...realArgs.slice(maxUsed + 1));
            } else if (arg === $rest) {
                args.push(realArgs.slice(maxUsed + 1));
            } else {
                args.push(arg);
            }
    
            return args;
        }, []));
    }

    if (fn[placeholderPath].includes($all)) {
        // depth of 1 is enforced currently
        return resolvedFn.map((fn, i) => applyTo(resolvedThisArg[i], fn, ...calledWith));
    }

    return applyTo(resolvedThisArg, resolvedFn, ...calledWith);
};

const placeholderHandler = {
    apply({ path }, thisArg, args) {
        if (!args.length) {
            return apply(noop(path.slice(0, path.length - 1)), noop(path));
        } else if (args[0][isPlaceholder]) {
            return apply(args[0], noop(path), ...args.slice(1));
        } else if (args[0] === $this) {
            return apply(noop(path.slice(0, path.length - 1)), noop(path), ...args.slice(1));
        } else {
            return resolve(args, path);
        }
    },
    get ({ path }, prop) {
        if (prop === isPlaceholder) return true;
        if (prop === placeholderPath) return path;

        if (prop === $all && path.includes($all)) {
            throw new ResolutionError('Cannot use the $all symbol more than once in a placeholder chain.');
        }

        return new Proxy(noop([...path, prop]), placeholderHandler);
    }
}

const $ = new Proxy(noop([]), placeholderHandler);
export const _ = new Proxy(noop([0]), placeholderHandler);

export const $args = new Proxy({}, {
    get(target, prop) {
        if (/^\$\d+$/.test(prop)) {
            return new Proxy(noop([parseInt(prop.slice(1))]), placeholderHandler);
        }

        if (/^\$[$_a-z][$_a-z0-9]*$/.test(prop)) {
            return _[prop.substr(1)];
        }

        return undefined;
    }
});
