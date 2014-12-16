Package.describe({
  summary: "Pseudo-boolean solver using MiniSat+ (minisat.se)",
  version: '1.0.0'
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR@1.0');
  api.export('PBSolver');
  api.use('check');
  api.use('underscore');
  api.add_files(['minisatp.js', 'api.js']);
});

Package.on_test(function (api) {
  api.versionsFrom('METEOR@1.0');
  api.use('tinytest');
  api.use('david:pbsolver');
  api.add_files('pbsolver_tests.js');
});
