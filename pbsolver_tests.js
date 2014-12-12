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
