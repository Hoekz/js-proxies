// CODE 1

const captainsLog = new Proxy({}, {
    set(target, prop, value) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(prop)) {
            // We could add a more robust date check if necessary, but this will do fine for now
            target[prop] = value;
        }

        return true; // always indicate success for silent failures
    }
});

captainsLog['2020-01-01'] = 'I feel this is going to be a great year.';
captainsLog['2020-01-02'] = 'I no longer feel confident about this year.';
captainsLog['2020'] = 'I want to make a note about the whole year.';

console.log(JSON.stringify(captainsLog, null, 4));
/*
{
    "2020-01-01": "I feel this is going to be a great year.",
    "2020-01-02": "I no longer feel confident about this year."
}
*/


// CODE 2

captainsLog['2020-01-01'] = 'I feel this is going to be a great year.';

captainsLog.addEntry('2020-01-01', 'I feel this is going to be a great year.');


