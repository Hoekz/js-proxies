import assert from 'assert';
import { _, $this, $rest, $$rest, $args, $all, ResolutionError } from './proxies/placeholder.mjs';

let indent = 0;
let count = 0;
const location = [];

const errors = [];

function describe(desc, fn) {
    console.log(`${'  '.repeat(indent)}${desc}`);
    location.push(desc);
    indent++;


    fn();

    indent--;
    location.pop();
    console.log('');
}

function it(desc, fn) {
    count++;

    try {
        fn();
        console.log(`${'  '.repeat(indent)} [ ] ${desc}`);
    } catch(e) {
        console.log(`${'  '.repeat(indent)} [X] ${desc}`);
        console.log(`${'  '.repeat(indent + 2)} ${e.message}`);
        errors.push([[...location, desc], e]);
    }
}

it.skip = () => {};

describe('placeholder', () => {
    describe('_ (underscore)', () => {
        it('should extract a single property', () => {
            const data = [{ b: 1 }, { b: 2 }];
            const expected = [1, 2];

            const actual = data.map(_.b);

            assert.deepStrictEqual(actual, expected);
        });

        it('should deep extract', () => {
            const data = [
                { a: [{ b: 2 }] },
                { a: [{ b: 3 }] },
            ];
            const expected = [2, 3];

            const actual = data.map(_.a[0].b)

            assert.deepStrictEqual(actual, expected);
        });

        it('should call method', () => {
            const data = [
                { func() { return 3; } },
                { func() { return 4; } },
            ];
            const expected = [3, 4];

            const actual = data.map(_.func());

            assert.deepStrictEqual(actual, expected);
        });

        it('should deep call method', () => {
            const data = [
                { prop: { func() { return 4; } } },
                { prop: { func() { return 5; } } },
            ];
            const expected = [4, 5];

            const actual = data.map(_.prop.func());

            assert.deepStrictEqual(actual, expected);
        });

        it('should bind to the object for calls', () => {
            const data = [
                { prop: 5, func() { return this.prop } },
                { prop: 6, func() { return this.prop } },
            ];
            const expected = [5, 6];

            const actual = data.map(_.func());

            assert.deepStrictEqual(actual, expected);
        });

        it('should bind to the deep object for calls', () => {
            const data = [
                { obj: { prop: 6, func() { return this.prop } } },
                { obj: { prop: 7, func() { return this.prop } } },
            ];
            const expected = [6, 7];

            const actual = data.map(_.obj.func());

            assert.deepStrictEqual(actual, expected);
        });

        it('should call method with args', () => {
            const data = [
                { prop: 7, func(n) { return n * this.prop } },
                { prop: 8, func(n) { return n * this.prop } },
            ];
            const expected = [35, 40];

            const actual = data.map(_.func($this, 5));

            assert.deepStrictEqual(actual, expected);
        });

        it('should deep call method with args', () => {
            const data = [
                { obj: { prop: 8, func(n) { return n * this.prop } } },
                { obj: { prop: 9, func(n) { return n * this.prop } } },
            ];
            const expected = [40, 45];

            const actual = data.map(_.obj.func($this, 5));

            assert.deepStrictEqual(actual, expected);
        });

        it('should call method with other referenced args', () => {
            const data = [
                { prop: 9, factor: 5, func(n) { return n * this.prop } },
                { prop: 10, factor: 6, func(n) { return n * this.prop } },
            ];
            const expected = [45, 60];

            const actual = data.map(_.func($this, _.factor));

            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('$$rest', () => {
        it('should be able to provide the rest of the arguments to a call', () => {
            class TestCase {
                constructor(prop) {
                    this.prop = prop;
                }

                isFirst(index, array) {
                    return array.findIndex(entry => entry.prop === this.prop) === index;
                }
            }

            const data = [
                new TestCase(1),
                new TestCase(2),
                new TestCase(1),
                new TestCase(3),
                new TestCase(2),
            ];
            const expected = [true, true, false, true, false];

            const actual = data.map(_.isFirst(_, $$rest));

            assert.deepStrictEqual(actual, expected);
        });

        // it('should be able to reposition rest of the arguments to a call', () => {})
    });

    describe('$rest', () => {
        it('should be able to provide the rest of the arguments as a single arg to a call', () => {
            class TestCase {
                constructor(prop) {
                    this.prop = prop;
                }

                isFirst([index, array]) {
                    return array.findIndex(entry => entry.prop === this.prop) === index;
                }
            }

            const data = [
                new TestCase(1),
                new TestCase(2),
                new TestCase(1),
                new TestCase(3),
                new TestCase(2),
            ];
            const expected = [true, true, false, true, false];

            const actual = data.map(_.isFirst(_, $rest));

            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('$args', () => {
        it('should be able to reference an arg besides the first', () => {
            const { $1, $0 } = $args;

            const data = [
                2, 2, 2, 2, 2, 2, 2, 2, 2, // 0 - 8
                8, 8, // 9 - 10
                10, 10, 10, 10, 10, 10, // 11 - 16
                16, 16, 16, // 17 - 19
            ];
            const expected = [
                '0', '1', '10', '11', '100', '101', '110', '111', '1000',
                '11', '12',
                '11', '12', '13', '14', '15', '16',
                '11', '12', '13',
            ];

            const actual = data.map($1.toString($this, $0));

            assert.deepStrictEqual(actual, expected);
        });
    });

    describe('$all', () => {
        it('should pull properties from each entry in an array', () => {
            const data = [
                { array: [{ a: 1 }, { a: 2 }] },
                { array: [{ a: 3 }, { a: 4 }] },
            ];
            const expected = [[1, 2], [3, 4]];

            const actual = data.map(_.array[$all].a);

            assert.deepStrictEqual(actual, expected);
        });

        it('should be able to be combined with method calls', () => {
            const data = [
                { array: [
                    { prop: 1, a(n) { return n * this.prop } },
                    { prop: 2, a(n) { return n * this.prop } },
                ] },
                { array: [
                    { prop: 3, a(n) { return n * this.prop } },
                    { prop: 4, a(n) { return n * this.prop } },
                ] },
            ];
            const expected = [[10, 20], [30, 40]];

            const actual = data.map(_.array[$all].a($this, 10));

            assert.deepStrictEqual(actual, expected);
        });

        it('should not be able to be used more than once in a placeholder chain', () => {
            try {
                [].map(_[$all][$all]);
                assert.fail('Use of $all twice did not throw.');
            } catch(e) {
                assert.ok(e instanceof ResolutionError);
            }
        });

        it('should only be able to refer to arrays', () => {
            const good = [[1, 2, 3], [4, 5, 6]].map(_[$all].toString($this, 2));
            const expected = [['1', '10', '11'], ['100', '101', '110']];

            assert.deepStrictEqual(good, expected);

            try {
                [{ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 }].map(_[$all].toString($this, 2));
                assert.fail('$all referring to object did not throw.');
            } catch(e) {
                assert.ok(e instanceof TypeError);
            }
        });
    });
});

if (errors.length) {
    console.log(`${count - errors.length} tests passed.`);
    console.log(`${errors.length} tests failed.`);

    errors.forEach(([location, err], i) => {
        console.log(`\n${i + 1})\t${location.join(' > ')}\n`);
        console.log(err, '\n');
    });
} else {
    console.log(`${count} tests passed.`);
}
