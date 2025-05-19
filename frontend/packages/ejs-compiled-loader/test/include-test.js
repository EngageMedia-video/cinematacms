const assert = require('assert');

// Test the include functionality
var tplWithInclude = require('./subdir/parent.ejs');
const result = tplWithInclude({ foo: "foo" });
console.log('Include test result:', result);
assert.equal(result, "parent: child: foo\n", "Include test failed");

console.log('All tests passed!');
