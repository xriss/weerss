const path = require('path');

const webpack = require('webpack');


let dd=new Date()
let da=new Date(dd.getFullYear(), 0, 0)
let db=new Date(dd.getFullYear()+1, 0, 0)
let dd_yy=(dd.getFullYear()-2000)
let dd_dd=Math.floor( 100000 * (dd-da) / (db-da) )
let dd_version=dd_yy+"."+( ("0000"+dd_dd).slice(-5) )

console.log("VERSION == "+dd_version)

module.exports = {
  module: {
    rules: [
      {
        test: /\.(txt|md|html|css|csv)$/i,
        use: 'raw-loader',
      },
    ],
  },
  plugins: [
	new webpack.DefinePlugin({
		__THIS_IS_WEBPACK__:true,
		__VERSION__: JSON.stringify(dd_version)
	}),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
	new webpack.ProvidePlugin({
		Buffer: ['buffer', 'Buffer'],
	}),
  ],
  entry: './weerss.js',
  resolve: {
    fallback : {
		fs: false,
		url: false,
		path: require.resolve("path-browserify"),
		"stream": require.resolve("stream-browserify"),
		"buffer": require.resolve("buffer/"),
    },
  },
  performance: {
    hints: false,
    maxEntrypointSize: 555555,
    maxAssetSize: 555555,
  },
  output: {
    path: path.resolve(__dirname, '../docs/js/'),
    filename: 'weerss.js',
    globalObject: 'this',
    library: {
      name: 'weerss',
      type: 'umd',
    },
  },
};

