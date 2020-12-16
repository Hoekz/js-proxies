function dimensions(arrayOrQuery) {
    if (arrayOrQuery instanceof Array) {
        return {
            columns: [0, start[0].length - 1],
            rows: [0, start.length - 1],
            width: start[0].length,
            height: start.length,
        }
    }

    const [start, end] = arrayOrQuery.split(':');

    const [startAlpha, startDecimal] = start.split(/(\d+)/);
    const colStart = startAlpha.charCodeAt();
    const rowStart = parseInt(startDecimal);

    if (!end) {
        return {
            columns: [colStart, colStart],
            rows: [rowStart, rowStart],
            width: 1,
            height: 1,
        };
    }

    const [endAlpha, endDecimal] = end.split(/(\d+)/);
    const colEnd = endAlpha.charCodeAt();
    const rowEnd = parseInt(endDecimal);

    return {
        columns: [colStart, colEnd],
        rows: [rowStart, rowEnd],
        width: colEnd - colStart + 1,
        height: rowEnd - rowStart + 1,
    };
}

function* range(query) {
    const { columns, rows } = dimensions(query);

    for (let row = rows[0]; row <= rows[1]; row++) {
        for (let col = columns[0]; col <= columns[1]; col++) {
            yield [String.fromCharCode(col), row];
        }
    }
}

function* emit(value) {
    while(true) {
        yield value;
    }
}

const contains = (cell) => (query) => {
    const { columns, rows } = dimensions(query);
    const [cellAlpha, cellDecimal] = cell.split(/(\d+)/);
    const cellCol = cellAlpha.charCodeAt();
    const cellRow = parseInt(cellDecimal);

    return columns[0] <= cellCol && columns[1] >= cellCol && rows[0] <= cellRow && rows[1] >= cellRow;
};

const overlaps = (queryA) => (queryB) => {
    const a = dimensions(queryA);
    const b = dimensions(queryB);

    const colOverlap = a.columns[0] < b.columns[0] ? a.columns[1] >= b.columns[0] : a.columns[0] <= b.columns[1];
    const rowOverlap = a.rows[0] < b.rows[0] ? a.rows[1] >= b.rows[0] : a.rows[0] <= b.rows[1];

    return rowOverlap && colOverlap;
};

function extract(sheet, range) {
    const data = [];
    let firstCol;

    for (const [col, row] of range) {
        firstCol = firstCol || col;

        if (firstCol === col) {
            data.push([]);
        }

        data[data.length - 1].push(sheet[col + row]);
    }

    return data;
}

function* zip(...generators) {
    const iterators = generators.map(gen => {
        if (gen instanceof Array) {
            return gen.flat()[Symbol.iterator]();
        }

        return gen[Symbol.iterator]()
    });

    while (true) {
        const step = iterators.map(it => it.next());

        if (step.some(e => e.done)) {
            return;
        }

	    yield step.map(e => e.value);
    }
}

function setRange(sheet, targetRange, source) {
    for (const [target, value] of zip(targetRange, source)) {
        sheet[target.join('')] = value;
    }
}

const spreadsheetHandler = {
    get(target, prop) {
        if (prop === 'toJSON') {
            return () => JSON.parse(JSON.stringify(target.data));
        }

        if (typeof prop === 'symbol') {
            return target[prop];
        }

        if (/^[A-Z]+\d+$/.test(prop)) {
            // get individual cell
            return target.data[prop];
        }

        if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(prop)) {
            // get range of cells
            return extract(target.data, range(...prop.split(':')));
        }
    },
    set(target, prop, value, sheet) {
        if (/^[A-Z]+\d+$/.test(prop)) {
            if (value instanceof Formula) {
                target.watchers[prop] = new BoundFormula(sheet, prop, value);
                target.data[prop] = value.eval();
            } else {
                target.data[prop] = value;
            }

            for (const watcher of Object.values(target.watchers)) {
                if (watcher.matches(prop)) {
                    if (target.batch) {
                        target.batch.add(watcher);
                    } else {
                        watcher.update();
                    }
                }
            }
        }

        if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(prop)) {
            target.batch = new Set();
            const size = dimensions(prop);

            if (!(value instanceof Object) || value instanceof Date) {
                setRange(sheet, range(prop), value);
            } else if (value instanceof Formula) {
                if (value.dependencies.some(overlaps(prop))) {
                    throw new Error('Cannot set formula for cells that are listed as inputs');
                }

                if (value.dependencies.map(dimensions).every(({ width, height }) => {
                    if (width === 1 && height === 1) {
                        return true;
                    }

                    return width === size.width && height === size.height;
                })) {
                    const partitions = value.dependencies.map(dep => dep.includes(':') ? range(dep) : emit(dep));

                    for (const [cell, ...dependencies] of zip(range(prop), ...partitions)) {
                        sheet[cell.join('')] = new Formula(value.target, dependencies.map(dep => dep.join('')), value.mapper);
                    }
                } else {
                    throw new TypeError('Formula dependency dimensions do not match target dimensions.');
                }
            } else {
                const valueSize = dimensions(value);
                
                if (propSize.width !== valueSize.width || propSize.height !== valueSize.height) {
                    throw new TypeError(`Dimensions of ${prop} do not match those of the input.`);
                }
                
                setRange(sheet, range(prop), value);
            }

            const { batch } = target;
            delete target.batch;

            for (const watcher of batch) {
                if (target.watchers[watcher.cell] === watcher) {
                    watcher.update();
                }
            }
        }

        return true;
    },
};

const identity = e => e;

class BoundFormula {
    constructor(target, cell, formula) {
        this.target = target;
        this.cell = cell;
        this.formula = formula;
        Object.freeze(this);
    }

    update() {
        this.target[this.cell] = this.formula.eval();
    }

    matches(cell) {
        return this.formula.matches(cell);
    }
}

class Formula {
    constructor(target, dependencies, mapper = identity) {
        this.target = target;
        this.dependencies = dependencies.slice();
        this.mapper = mapper;
        Object.freeze(this);
    }

    eval() {
        return this.mapper(...this.dependencies.map(query => this.target[query]));
    }

    matches(cell) {
        return this.dependencies.some(contains(cell));
    }
}

function formula(target, dependencies, mapper) {
    return new Formula(target, dependencies, mapper);
}

const sheet = new Proxy({ data: {}, watchers: {} }, spreadsheetHandler);

sheet['A1'] = 12;
sheet['A2'] = 13;
sheet['B1'] = sheet['A1']; // 12
sheet['B2'] = formula(sheet, ['A2']); // =A2 -> 13
sheet['C1:C2'] = formula(sheet, ['A1:A2', 'B1:B2'], (a, b) => a + b); // =A1:A2+B1:B2 -> 24, 26
sheet['A1'] = 15; // C1 -> 27
console.log(sheet.toJSON());
