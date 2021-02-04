const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'cdjson-api.js',
    library: 'CDJsonAPI',
    libraryTarget: 'var'
  },
  externals: {
    jquery: 'jQuery'
  }
};