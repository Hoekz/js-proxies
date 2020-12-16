class Mystery {
    constructor(range) {
        this._range = range;
        this._value = Math.ceil(Math.random() * range);
        this._guessed = false;
    }

    get guessed() {
        return this._guessed;
    }

    reset() {
        this._guessed = false;
        this._previous = this._value;
        this._value = Math.ceil(Math.random() * this._range);
    }

    guess(value) {
        if (this._value === value) {
            return this._guessed = true;
        }

        return false;
    }
}

const privateInstanceProxy = {
    get(target, prop) {
        if (prop.startsWith('_')) {
            return undefined;
        }

        return target[prop];
    },
    set(target, prop, value) {
        if (!prop.startsWith('_')) {
            target[prop] = value;
        }

        return true;
    },
    has(target, prop) {
        return !prop.startsWith('_') && (prop in target);
    },
};

const privateClassProxy = {
    construct(target, args) {
        const instance = new target(...args);

        const methods = Object.getOwnPropertyNames(target.prototype).filter(prop => {
            return prop !== 'constructor' && instance[prop] instanceof Function
        });

        methods.forEach(method => instance[method] = instance[method].bind(instance));

        return new Proxy(instance, privateInstanceProxy);
    }
};

Mystery = new Proxy(Mystery, privateClassProxy);

const instance = new Mystery(10);

console.log('instance._value:', instance._value); // undefined
console.log('instance._guessed', instance._guessed); // undefined
console.log('instance.guessed', instance.guessed); // false

for (let guess = 1; guess <= 10; guess++) {
    console.log('guessing:', guess, instance.guess(guess)); // 1 true, rest false
}

console.log('instance.guessed before reset:', instance.guessed); // true

instance.reset();

console.log('instance.guessed after reset:',instance.guessed); // false
console.log('is _previous in instance:', '_previous' in instance); // false
