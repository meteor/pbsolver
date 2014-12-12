PBSolver = function () {
  var C = this._C = cMinisatp();
  this._native = {
    getStackPointer: function () {
      return C.Runtime.stackSave();
    },
    setStackPointer: function (ptr) {
      C.Runtime.stackRestore(ptr);
    },
    allocateBytes: function (len) {
      return C.allocate(len, 'i8', C.ALLOC_STACK);
    },
    pushString: function (str) {
      return this.allocateBytes(C.intArrayFromString(str));
    },
    savingStack: function (func) {
      var SP = this.getStackPointer();
      var ret = func(this, C);
      this.setStackPointer(SP);
      return ret;
    }
  };

  C._createTheSolver();

  this._nextGenVarNum = 1;
};

// This is just a test of passing in a string that gets split
// and counted.
PBSolver.prototype._countLines = function (str) {
  return this._native.savingStack(function (native, C) {
    return C._countLines(native.pushString(str));
  });
};

var VariableName = Match.Where(function (x) {
  check(x, String);
  if (x.indexOf('\n') >= 0) {
    return false;
  }
  if (x.charAt(0) === '`') {
    return /^`[1-9][0-9]*$/.test(x);
  }
  return true;
});
var WholeNumber = Match.Where(function (x) {
  check(x, Match.Integer);
  return x >= 0;
});

PBSolver.prototype.addClause = function (positives, negatives) {
  negatives = negatives || [];
  check(positives, [VariableName]);
  check(negatives, [VariableName]);

  this._native.savingStack(function (native, C) {
    C._addClause(native.pushString(positives.join('\n')),
                 native.pushString(negatives.join('\n')));
  });
};

var TYPE_CODES = {
  '<': -2, '<=': -1, '=': 0, '>=': 1, '>': 2
};

PBSolver.prototype.addConstraint = function (vars, coeffs, type, rhs) {
  if (typeof coeffs === 'number') {
    // turn a coeffs of `1` into `[1, 1, 1]`, for example, if there
    // are three vars.
    coeffs = _.map(vars, function () { return coeffs; });
  }
  coeffs.length = vars.length;
  check(vars, [VariableName]);
  check(coeffs, [WholeNumber]);
  check(type, Match.OneOf('<', '<=', '=', '>=', '>'));
  check(rhs, WholeNumber);

  this._native.savingStack(function (native, C) {
    var coeffsPtr = C.allocate(vars.length*4, 'i32', C.ALLOC_STACK);
    _.each(coeffs, function (c, i) {
      C.setValue(coeffsPtr + i*4, c, 'i32');
    });
    C._addConstraint(native.pushString(vars.join('\n')),
                     coeffsPtr,
                     TYPE_CODES[type],
                     rhs);
  });
};

PBSolver.prototype.exactlyOne = function (vars) {
  // XXX consider improving translation to SAT using this paper:
  // http://www.cs.cmu.edu/~wklieber/papers/2007_efficient-cnf-encoding-for-selecting-1.pdf
  this.addConstraint(vars, 1, '=', 1);
};

PBSolver.prototype.atMostOne = function (vars) {
  // consider optimizing this (see exactlyOne)
  this.addConstraint(vars, 1, '<=', 1);
};

PBSolver.prototype.atLeastOne = function (vars) {
  this.addClause(vars);
};

PBSolver.prototype.isTrue = function (v) {
  this.addClause([v]);
};

PBSolver.prototype.isFalse = function (v) {
  this.addClause([], [v]);
};

PBSolver.prototype.implies = function (p, q) {
  this.addClause([q], [p]);
};

PBSolver.prototype.impliesNot = function (p, q) {
  this.addClause([], [p, q]);
}

PBSolver.prototype.notPImpliesQ = function (p, q) {
  // (not p) implies q -- same as OR
  this.addClause([p, q]);
};

PBSolver.prototype.notPImpliesNotQ = function (p, q) {
  this.addClause([p], [q]);
};

// returns `null` or an array of the variables that are positive,
// in sorted order.
PBSolver.prototype.solve = function () {
  if (! this._C._solve()) {
    return null;
  }

  var numVariables = this._C._getNumVariables();
  var trueVariables = [];
  this._native.savingStack(function (native, C) {
    var result = native.allocateBytes(numVariables);
    C._getSolution(result);
    for (var i = 0; i < numVariables; i++) {
      if (C.HEAPU8[result + i]) {
        var varNamePtr = C._getVariableAtIndex(i);
        if (C.HEAPU8[varNamePtr] !== 96) { // Doesn't start with backtick `
          trueVariables.push(C.Pointer_stringify(varNamePtr));
        }
      }
    }
  });

  trueVariables.sort();
  return trueVariables;
};

PBSolver.prototype.genVar = function () {
  return "`" + (this._nextGenVarNum++);
};
