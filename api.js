PBSolver = function () {
  var C = this._C = cMinisatp();
  this._native = {
    getStackPointer: function () {
      return C.Runtime.stackSave();
    },
    setStackPointer: function (ptr) {
      C.Runtime.stackRestore(ptr);
    },
    pushString: function (str) {
      return C.allocate(C.intArrayFromString(str), 'i8',
                        C.ALLOC_STACK);
    }
  };
};

PBSolver.prototype.countLines = function (str) {
  var SP = this._native.getStackPointer();
  var arg = this._native.pushString(str);
  var ret = this._C._countLines(arg);
  this._native.setStackPointer(SP);
  return ret;
};
