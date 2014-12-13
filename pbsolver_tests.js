Tinytest.add("pbsolver - basic", function (test) {
  var solver = new PBSolver();
  test.equal(solver._countLines("foo"), 1);
  test.equal(solver._countLines("foo\nbar"), 2);
  test.equal(solver._countLines("\nfoo\n\nbar\n\n"), 2);
  test.equal(solver._countLines(""), 0);
  test.equal(solver._countLines("\n"), 0);
});

Tinytest.add("pbsolver - solve with clauses", function (test) {
  var solver = new PBSolver();
  var exactlyOneOfTheseThree = function (a, b, c) {
    solver.addClause([a, b, c]); // at least one
    solver.addClause([], [a, b]); // not(A) or not(B)
    solver.addClause([], [b, c]); // etc
    solver.addClause([], [a, c]); // etc
  };
  exactlyOneOfTheseThree('11', '12', '13');
  exactlyOneOfTheseThree('21', '22', '23');
  exactlyOneOfTheseThree('31', '32', '33');
  exactlyOneOfTheseThree('11', '21', '31');
  exactlyOneOfTheseThree('12', '22', '32');
  exactlyOneOfTheseThree('13', '23', '33');
  solver.addClause(['12']);
  solver.addClause([], ['21']);
  test.equal(solver.solve(), ['12', '23', '31']);
});

Tinytest.add("pbsolver - solve with constraints", function (test) {
  var solver = new PBSolver();
  var exactlyOneOfTheseThree = function (a, b, c) {
    solver.addConstraint([a, b, c], 1, '=', 1);
  };
  exactlyOneOfTheseThree('11', '12', '13');
  exactlyOneOfTheseThree('21', '22', '23');
  exactlyOneOfTheseThree('31', '32', '33');
  exactlyOneOfTheseThree('11', '21', '31');
  exactlyOneOfTheseThree('12', '22', '32');
  exactlyOneOfTheseThree('13', '23', '33');
  solver.addClause(['12']);
  solver.addClause([], ['21']);
  test.equal(solver.solve(), ['12', '23', '31']);
});

Tinytest.add("pbsolver - solve with exactlyOne", function (test) {
  var solver = new PBSolver();
  solver.exactlyOne(['11', '12', '13']);
  solver.exactlyOne(['21', '22', '23']);
  solver.exactlyOne(['31', '32', '33']);
  solver.exactlyOne(['11', '21', '31']);
  solver.exactlyOne(['12', '22', '32']);
  solver.exactlyOne(['13', '23', '33']);
  solver.isTrue('12');
  solver.isFalse('21');
  test.equal(solver.solve(), ['12', '23', '31']);
});

Tinytest.add("pbsolver - eight queens", function (test) {
  var boardSquare = function (r, c) {
    return String(r) + String(c);
  };

  var solver = new PBSolver();
  var nums = _.range(1, 9); // 1..8
  _.each(nums, function (x) {
    // one per row x, one per column x
    solver.exactlyOne(_.map(nums, function (y) {
      return boardSquare(x, y);
    }));
    solver.exactlyOne(_.map(nums, function (y) {
      return boardSquare(y, x);
    }));
  });

  // At most one queen per diagonal.  A diagonal
  // consists of squares whose row + column sums
  // to a constant, or the horizontal flip of
  // such a set of squares.
  for (var flip = 0; flip <= 1; flip++) {
    for (var sum = 2; sum <= 16; sum++) {
      var vars = [];
      for (var r = 1; r <= sum-1; r++) {
        var c = sum - r;
        if (flip)
          c = 9-c;
        if (r >= 1 && r <= 8 && c >= 1 && c <= 8) {
          vars.push(boardSquare(r,c));
        }
      }
      solver.atMostOne(vars);
    }
  }

  var solution = solver.solve();

  // solution might be, for example,
  // ["16", "24", "31", "45", "58", "62", "77", "83"]
  test.equal(solution.length, 8);
  test.isTrue(/^([1-8][1-8],){7}[1-8][1-8]$/.test(solution.join(',')));
  var assertEightDifferent = function (transformFunc) {
    test.equal(_.uniq(_.map(solution, transformFunc)).length, 8);
  };
  // queens occur in eight different rows, eight different columns
  assertEightDifferent(function (queen) { return queen.charAt(0); });
  assertEightDifferent(function (queen) { return queen.charAt(1); });
  // queens' row/col have eight different sums, eight different differences
  assertEightDifferent(function (queen) {
    return Number(queen.charAt(0)) - Number(queen.charAt(1));
  });
  assertEightDifferent(function (queen) {
    return Number(queen.charAt(0)) + Number(queen.charAt(1));
  });
});

Tinytest.add("pbsolver - genVar", function (test) {
  var solver = new PBSolver();
  var a = solver.genVar();
  var b = solver.genVar();
  var c = solver.genVar();

  solver.implies(a, "1");
  solver.notPImpliesNotQ(a, "1");
  solver.impliesNot(a, "2");
  solver.implies(a, "3");

  solver.implies(b, "2");
  solver.implies(b, "4");

  solver.impliesNot(c, "3");
  solver.impliesNot(c, "5");

  // Forced to choose two of a, b, c, we must choose
  // b and c, because they each conflict with a.
  solver.addConstraint([a, b, c], 1, '=', 2);

  test.equal(solver.solve(), ["2", "4"]);
});


Tinytest.add("pbsolver - Sudoku", function (test) {
  var v = function (row, col, value) {
    return row + "," + col + "=" + value;
  };

  var solver = new PBSolver();

  // All rows, columns, and digits are 0-based internally.
  for (var x = 0; x < 9; x++) {
    // Find the top-left of box x. For example, Box 0 has a top-left
    // of (0,0).  Box 3 has a top-left of (3,0).
    var boxRow = Math.floor(x/3)*3;
    var boxCol = (x%3)*3;
    for (var y = 0; y < 9; y++) {
      var numberInEachSquare = [];
      var columnHavingYInRowX = [];
      var rowHavingYInColumnX = [];
      var squareHavingYInBoxX = [];
      for (var z = 0; z < 9; z++) {
        numberInEachSquare.push(v(x,y,z));
        columnHavingYInRowX.push(v(x,z,y));
        rowHavingYInColumnX.push(v(z,x,y));
        squareHavingYInBoxX.push(v(
          boxRow + Math.floor(z/3),
          boxCol + (z%3),
          y));
      }
      solver.exactlyOne(numberInEachSquare);
      solver.exactlyOne(columnHavingYInRowX);
      solver.exactlyOne(rowHavingYInColumnX);
      solver.exactlyOne(squareHavingYInBoxX);
    }
  }

  // Input a pretty hard Sudoku from here:
  // http://www.menneske.no/sudoku/eng/showpuzzle.html?number=6903541
  var puzzle = [
    "....839..",
    "1......3.",
    "..4....7.",
    ".42.3....",
    "6.......4",
    "....7..1.",
    ".2.......",
    ".8...92..",
    "...25...6"
  ];
  for (var r = 0; r < 9; r++) {
    var str = puzzle[r];
    for (var c = 0; c < 9; c++) {
      // zero-based digit
      var digit = str.charCodeAt(c) - 49;
      if (digit >= 0 && digit < 9) {
        solver.isTrue(v(r, c, digit));
      }
    }
  }

  var solution = solver.solve();
  var solutionString = _.map(solution, function (v) {
    return String(Number(v.slice(-1)) + 1);
  }).join('').match(/.{9}/g).join('\n');
  test.equal(solutionString, [
    "765483921",
    "198726435",
    "234915678",
    "842531769",
    "617892354",
    "359674812",
    "926147583",
    "581369247",
    "473258196"
  ].join('\n'));
});

Tinytest.add("pbsolver - toy packages", function (test) {

  var withSolver = function (func) {

    var solver = new PBSolver();

    _.each(allPackageVersions, function (versions, package) {
      versions = _.map(versions, function (v) {
        return package + "@" + v;
      });
      // e.g. atMostOne(["foo@1.0.0", "foo@1.0.1", "foo@2.0.0"])
      solver.atMostOne(versions);
      // e.g. equalsOr("foo", ["foo@1.0.0", ...])
      solver.equalsOr(package, versions);
    });

    _.each(dependencies, function (depMap, packageVersion) {
      _.each(depMap, function (compatibleVersions, package2) {
        // e.g. implies("bar@1.2.4", "foo")
        solver.implies(packageVersion, package2);
        // Now ban all incompatible versions of package2 if
        // we select this packageVersion
        _.each(allPackageVersions[package2], function (v) {
          if (! _.contains(compatibleVersions, v)) {
            solver.impliesNot(packageVersion,
                              package2 + "@" + v);
          }
        });
      });
    });

    var solve = function () {
      var solution = solver.solve();
      if (! solution) {
        return solution; // null
      } else {
        // only return variables like "foo@1.0.0", not "foo"
        return _.filter(solution, function (v) {
          return v.indexOf('@') >= 0;
        });
      }
    };

    func(solver, solve);
  };

  var allPackageVersions = {
    'foo': ['1.0.0', '1.0.1', '2.0.0'],
    'bar': ['1.2.3', '1.2.4', '1.2.5'],
    'baz': ['3.0.0']
  };

  // Exact dependencies.  No inequalities for this toy example, and no
  // cost function, so our test problems have unique solutions.
  var dependencies = {
    'bar@1.2.3': { foo: ['1.0.0'] },
    'bar@1.2.4': { foo: ['1.0.1'] },
    'bar@1.2.5': { foo: ['2.0.0'] },
    'baz@3.0.0': { foo: ['1.0.0', '1.0.1'],
                   bar: ['1.2.4', '1.2.5'] }
  };

  withSolver(function (solver, solve) {
    // Ask for "bar@1.2.5", get both it and "foo@2.0.0"
    solver.isTrue("bar@1.2.5");
    test.equal(solve(), ["bar@1.2.5", "foo@2.0.0"]);
  });

  withSolver(function (solver, solve) {
    // Ask for "foo@1.0.1" and *some* version of bar!
    solver.isTrue("foo@1.0.1");
    solver.isTrue("bar");
    test.equal(solve(), ["bar@1.2.4", "foo@1.0.1"]);
  });

  withSolver(function (solver, solve) {
    // Ask for versions that can't be combined
    solver.isTrue("foo@1.0.1");
    solver.isTrue("bar@1.2.3");
    test.equal(solve(), null);
  });

  withSolver(function (solver, solve) {
    // Ask for baz, automatically get versions of foo and bar
    // such that foo satisfies bar's dependency!
    solver.isTrue("baz");
    test.equal(solve(), ["bar@1.2.4",
                         "baz@3.0.0",
                         "foo@1.0.1"]);
  });
});
