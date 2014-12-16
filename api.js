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
  this._numClausesAdded = 0;
  this._numConstraintsAdded = 0;

  this._usedVars = {};
  this._solved = false;
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

PBSolver.prototype.validateVar = function (v) {
  var k = ' '+v;
  if (this._solved) {
    // Because of the way variable names are converted to
    // numbers in the solver, we can only do it before the solver
    // has been run.  We could fix this by doing all name mapping
    // in JS.
    if (! _.has(this._usedVars, k)) {
      throw new Error("Can't add new vars after first solve");
    }
  } else {
    this._usedVars[k] = true;
  }
  return v;
};

PBSolver.prototype.validateVars = function (vv) {
  for (var i = 0; i < vv.length; i++) {
    this.validateVar(vv[i]);
  }
  return vv;
};

PBSolver.prototype.addClause = function (positives, negatives) {
  var self = this;
  negatives = negatives || [];
  check(positives, [VariableName]);
  check(negatives, [VariableName]);

  this.validateVars(positives);
  this.validateVars(negatives);

  self._native.savingStack(function (native, C) {
    C._addClause(native.pushString(positives.join('\n')),
                 native.pushString(negatives.join('\n')));
  });

  self._numClausesAdded++;
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

  this.validateVars(vars);

  this._native.savingStack(function (native, C) {
    var coeffsPtr = C.allocate(vars.length*4, 'i32', C.ALLOC_STACK);
    _.each(coeffs, function (c, i) {
      C.setValue(coeffsPtr + i*4, c, 'i32');
    });
    var varsPtr = native.pushString(vars.join('\n'));
    C._addConstraint(varsPtr, coeffsPtr, TYPE_CODES[type], rhs);
  });

  this._numConstraintsAdded++;
};


PBSolver.prototype.exactlyOne = function (vars) {
  if (! vars.length) {
    throw new Error("At least one variable required");
  }
  this.atMostOne(vars);
  this.atLeastOne(vars);
};

// Asserts the equivalence x == (A or B or ...)
PBSolver.prototype.equalsOr = function (x, vars) {
  // x implies (A or B or C).  A or B or C or (not x).
  this.addClause(vars, [x]);
  // (A or B or C) implies x, or equivalently,
  // ((not x) implies (not A)) and
  // ((not x) implies (not B)) and ...
  for (var j = 0; j < vars.length; j++) {
    this.implies(vars[j], x);
  }
};

PBSolver.prototype.atMostOne = function (vars) {
  if (! vars.length) {
    throw new Error("At least one variable required");
  }
  if (vars.length === 1) {
    // do nothing (always satisfied)
  } else if (vars.length <= 5) {
    // Generate O(N^2) clauses of the form:
    // ((not A) or (not B)) and ((not A) or (not C)) and ...
    // This generates a lot of clauses, but it results in fast
    // propagation when solving.  Definitely use it for N <= 5.
    for (var a = 0; a < vars.length; a++) {
      for (var b = a+1; b < vars.length; b++) {
        this.addClause([], [vars[a], vars[b]]);
      }
    }
  } else {
    // Use the "commander variables" technique from:
    // http://www.cs.cmu.edu/~wklieber/papers/2007_efficient-cnf-encoding-for-selecting-1.pdf
    // Group into groups of G (possibly with a short group at the end)
    var G = 3;
    var allCommanders = [];
    for (var i = 0; i < vars.length; i += G) {
      var group = vars.slice(i, i + G);
      this.atMostOne(group);
      var commander = this.genVar();
      this.equalsOr(commander, group);
      allCommanders.push(commander);
    }
    this.atMostOne(allCommanders);
  }
};

PBSolver.prototype.atLeastOne = function (vars) {
  if (! vars.length) {
    throw new Error("At least one variable required");
  }
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

var calcSolutionCost = function (solution, costVectorMap, costN) {
  var sum = 0;
  for (var i = 0; i < solution.length; i++) {
    var v = solution[i];
    if (costVectorMap[v]) {
      sum += (costVectorMap[v][costN] || 0);
    }
  }
  return sum;
};

// Takes a map from variable to an array of costs
// (small non-negative integers).  Among all possible
// solutions, picks the one that minimizes the sum of
// the first elements of the vectors corresponding to
// the "true" variables, and if there are still ties,
// the second elements, and so on.
PBSolver.prototype.optimize = function (costVectorMap) {
  if (this._solved) {
    throw new Error("Use optimize() instead of solve(), not after it");
  }
  var maxVectorLength = 0;
  var costVars = _.keys(costVectorMap);
  var costVectors = _.values(costVectorMap);
  _.each(costVectors, function (vec) {
    check(vec, [WholeNumber]);
    maxVectorLength = Math.max(maxVectorLength, vec.length);
  });
  // transpose of costVectors.  Length is maxVectorLength.
  var costValues = [];
  for (var i = 0; i < maxVectorLength; i++) {
    var values = [];
    costValues[i] = values;
    for (var j = 0; j < costVectors.length; j++) {
      values[j] = (costVectors[j][i] || 0);
    }
  }

  var solution = this.solve();
  if (! solution) {
    return null;
  }
  if (maxVectorLength === 0) {
    return solution;
  }

  var latestTemporaryVar = null;
  for (var n = 0; n < maxVectorLength; n++) {
    var solutionCost = calcSolutionCost(solution, costVectorMap, n);
    var newSolution;
    while ((solutionCost > 0) &&
           (newSolution = this._solveAgainWithConstraint(
             costVars, costValues[n], '<', solutionCost))) {

      solution = newSolution;
      var newCost = calcSolutionCost(solution, costVectorMap, n);
      if (newCost >= solutionCost) {
        throw new Error("Assertion failure: cost did not decrease");
      }
      solutionCost = newCost;
    }
    this.addConstraint(costVars, costValues[n], '=', solutionCost);
  }

  return solution;
};

// returns `null` or an array of the variables that are positive,
// in sorted order.
PBSolver.prototype.solve = function () {
  var satisfiable;

  if (! this._solved) {
    satisfiable = this._C._solve();
    this._solved = true;
  } else {
    // already solved; solving again
    satisfiable = this._C._solveAgain(-1);
  }

  if (! satisfiable) {
    return null;
  }

  return this._readOffSolution();
};

PBSolver.prototype._solveAgainWithAssumption = function (v) {
  if (! this._solved) {
    throw new Error("Must already have called solve()");
  }

  var satisfiable = this._native.savingStack(function (native, C) {
    return C._solveAgain(v);
  });

  if (! satisfiable) {
    return null;
  }

  return this._readOffSolution();
};

PBSolver.prototype._solveAgainWithConstraint =
  function (vars, coeffs, type, rhs) {
    if (! this._solved) {
      throw new Error("Must already have called solve()");
    }

    var conditionalVar = this._C._enterConditional();
    this.addConstraint(vars, coeffs, type, rhs);
    this._C._exitConditional();
    return this._solveAgainWithAssumption(conditionalVar);
  };

PBSolver.prototype._readOffSolution = function () {
  var numVariables = this._C._getNumVariables();
  var trueVariables = [];
  this._native.savingStack(function (native, C) {
    var result = native.allocateBytes(numVariables);
    C._getSolution(result);
    for (var i = 0; i < numVariables; i++) {
      //console.log(i,
      //C.Pointer_stringify(C._getVariableAtIndex(i)),
      //C.HEAPU8[result+i]);
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
  return this.validateVar("`" + (this._nextGenVarNum++));
};
