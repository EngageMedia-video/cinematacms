module.exports = {
  entry: './app.js',
  mode: 'production',
  target: 'node',
  cache: false,
  output: {
    path: __dirname,
    filename: 'bundle.js',
  },
  resolve: {
    fallback: {
    },
  },
  module: {
    rules: [
      {
        test: /\.ejs$/,
        use: {
          loader: require.resolve('../'),
          options: {
            htmlmin: true,
            htmlminOptions: {
              removeComments: true,
            },
          },
        },
      },
    ],
  },
  plugins: [
    new (require('webpack').ProvidePlugin)({
      Buffer: ['buffer', 'Buffer']
    })
  ],
};
