// sample data

const tests = [
    { student: 'Fred Jones', percentage: 82, answers: [5, 6, 7, { passion: 'traps' }] },
    { student: 'Daphne Blake', percentage: 91, answers: [5, 6, 7, { passion: 'fashion' }] },
    { student: 'Velma Dinkley', percentage: 106, answers: [5, 6, 7, { passion: 'intellect' }] },
];

// CODE 1

const assert = require('assert');

const average = (nums) => nums.reduce((total, num) => total + num, 0) / nums.length;

const scores = tests.map((test) => test.percentage);

assert.strictEqual(average(scores), 93);

// CODE 2

const getProp = (prop) => (obj) => obj[prop];

const scores = tests.map(getProp('percentage'));

assert.strictEqual(average(scores), 93);

// CODE 3 (scala)

listOfObjects.map(_.property);

// CODE 4

const placeholderHandler = {
    get(target, prop) {
        return getProp(prop);
    }
};

const _ = new Proxy({}, placeholderHandler);

const scores = tests.map(_.percentage);

assert.strictEqual(average(scores), 93);

// CODE 5

const getDeepProp = (...props) => (obj) => {
    for (const key of props) {
        obj = obj[key];
    }

    return obj;
};

const passions = tests.map(getDeepProp(['answers', 3, 'passion']));

assert.deepStrictEqual(passions, ['traps', 'fashion', 'intellect']);

// CODE 6

const placeholderHandler = {
    get(target, prop) {
        return new Proxy({}, placeholderHandler);
    }
};

// CODE 7

const placeholderHandler = {
    get(target, prop) {
        return new Proxy({ path: [...target.path, prop] }, placeholderHandler);
    }
};

const _ = new Proxy({ path: [] }, placeholderHandler);

const passions = tests.map(_.answers[3].passion); // ERROR: not a function

// CODE 8

const placeholderHandler = {
    apply(target, thisArg, args) {
        return getDeepProp(target.path)(args[0]);
    },
    get(target, prop) {
        return new Proxy({ path: [...target.path, prop] }, placeholderHandler);
    }
};

// CODE 9

const passions = tests.map(_.answers[3].passion); // ERROR: not a function

// CODE 10

const createNoop = (path) => {
    const noop = () => {};
    noop.path = path;

    return noop;
};

const placeholderHandler = {
    apply(target, thisArg, args) {
        return getDeepProp(target.path)(args[0]);
    },
    get(target, prop) {
        return new Proxy(createNoop([...target.path, prop]), placeholderHandler);
    }
};

const _ = new Proxy(createNoop([]), placeholderHandler);

const passions = tests.map(_.answers[3].passion);

assert.deepStrictEqual(passions, ['traps', 'fashion', 'intellect']);

// CODE 11

const identity = (a) => a;

const placeholderHandler = {
    get(target, prop) {
        return new Proxy((obj) => target(obj)[prop], placeholderHandler);
    }
};

const _ = new Proxy(identity, placeholderHandler);

const passions = tests.map(_.answers[3].passion);

assert.deepStrictEqual(passions, ['traps', 'fashion', 'intellect']);
