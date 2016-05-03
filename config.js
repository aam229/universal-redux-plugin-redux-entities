var environments = require('universal-redux/lib/hooks').environments;

module.exports = {
  environments: [
    environments.CLIENT,
    environments.SERVER,
    environments.DEVELOPMENT,
    environments.PRODUCTION 
  ]
};