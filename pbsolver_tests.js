Tinytest.add("pbsolver - basic", function (test) {
  var solver = new PBSolver();
  test.equal(solver._countLines("foo"), 1);
  test.equal(solver._countLines("foo\nbar"), 2);
  test.equal(solver._countLines("\nfoo\n\nbar\n\n"), 2);
  test.equal(solver._countLines(""), 0);
  test.equal(solver._countLines("\n"), 0);
});

Tinytest.add("pbsolver - basic solve", function (test) {
  var solver = new PBSolver();
  var exactlyOne = function (a, b, c) {
    solver.addClause([a, b, c]); // at least one
    solver.addClause([], [a, b]); // not(A) or not(B)
    solver.addClause([], [b, c]); // etc
    solver.addClause([], [a, c]); // etc
  };
  exactlyOne('11', '12', '13');
  exactlyOne('21', '22', '23');
  exactlyOne('31', '32', '33');
  exactlyOne('11', '21', '31');
  exactlyOne('12', '22', '32');
  exactlyOne('13', '23', '33');
  solver.addClause(['12']);
  solver.addClause([], ['21']);
  test.equal(solver.solve(), ['12', '23', '31']);
});
