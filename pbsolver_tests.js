Tinytest.add("pbsolver - basic", function (test) {
  var solver = new PBSolver();
  test.equal(solver.countLines("foo"), 1);
  test.equal(solver.countLines("foo\nbar"), 2);
  test.equal(solver.countLines("\nfoo\n\nbar\n\n"), 2);
  test.equal(solver.countLines(""), 0);
  test.equal(solver.countLines("\n"), 0);
});
