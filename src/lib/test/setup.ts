import '@testing-library/jest-dom';

if (typeof File !== 'undefined' && !File.prototype.arrayBuffer && typeof Blob !== 'undefined' && Blob.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return Blob.prototype.arrayBuffer.call(this);
  };
}
