var webpack = require("webpack");
var HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = {
  context: __dirname + '/src',
  entry: {
    app: './index.js',
    style: './style.scss',
    vendor: ['react', 'react-dom']
  },
  output: {
    path: __dirname + '/dist',
    filename: '[name].js'
  },
  devtool: 'eval-source-map',
  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" },
      {
        test: /\.scss$/,
        loaders: ["style", "css", "sass"]
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.bundle.js'),
    new HtmlWebpackPlugin({
      title: 'Orbis',
      template: 'index.html'
    })
  ]
}
