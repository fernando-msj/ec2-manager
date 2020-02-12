const AWS = require("aws-sdk");

AWS.config.loadFromPath("./auth.json");

const [flag] = process.argv.slice(2);

const FLAGS = {
  START: ["--start", "-i"],
  STOP: ["--stop", "-o"],
  TEST: ["--test", "-t"]
};

if (FLAGS.START.includes(flag)) {
  require("./start");
}

if (FLAGS.STOP.includes(flag)) {
  require("./stop");
}

if (FLAGS.TEST.includes(flag)) {
  require("./test");
}
