const watchers = new WeakMap();

const watchHandler = {
    set(target, prop, value) {
        target[prop] = value;

        watchers.get(target).forEach(({ run, on }) => {
            if (!on.size || on.has(prop)) {
                return run(proxied);
            }
        })
    }
};

function watchable(target) {
    const watched = new Proxy(target, watchHandler);

    watchers.set(target, []);

    return watched;
}

function watch(obj, run, on) {
    if (!watchers.has(obj)) {
        throw new Error('Objects that should be watched must first be registered as watchable.');
    }

    watchers.get(obj).push({ run, on: new Set(on) });

    return unwatch(obj, run);
}

function unwatch(obj, run) {
    return function() {
        const index = watchers.get(obj).findIndex(watcher => watcher.run === run);

        watchers.get(obj).splice(index, 1);
    }
}

const a = watchable({ prop: 0 });

const b = watchable({ prop: 0 });

const c = {};

watch(a, ({ prop }) => b.prop += prop, ['prop']);
watch(b, ({ prop }) => c.prop = prop * 2, ['prop']);
watch(a, ({ input1, input2 }) => input1 && input2 ? a.prop = input1 * input2 : null, ['input1', 'input2'])
console.log(a, b, c); // { prop: 0 } { prop: 0 } { }

a.prop++;
console.log(a, b, c); // { prop: 1 } { prop: 1 } { prop: 2 }

a.prop++;
console.log(a, b, c); // { prop: 2 } { prop: 3 } { prop: 6 }

a.prop++;
console.log(a, b, c); // { prop: 3 } { prop: 6 } { prop: 12 }

a.nothing = 123;
console.log(a, b, c); // { prop: 3, nothing: 123 } { prop: 6 } { prop: 12 }

a.input1 = 3;
a.input2 = 4;
console.log(a, b, c); // { input1: 3, input2: 4, prop: 12, nothing: 123 } { prop: 18 } { prop: 36 }
