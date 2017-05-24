var environments = require('universal-redux').environments;

module.exports = {
  environments: [
    environments.CLIENT,
    environments.SERVER,
    environments.DEVELOPMENT,
    environments.PRODUCTION
  ]
};